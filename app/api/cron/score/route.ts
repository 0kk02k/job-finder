import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { JobStatus } from '@prisma/client'
import { scoreJob, aiConfigFromSettings } from '@/lib/ai'
import { parseStoredProfile } from '@/lib/preferences'
import { HIGH_MATCH_THRESHOLD } from '@/lib/matching'
import { pickUnscoredBatch, scoreUpdatePayload } from '@/lib/scoring'

export const maxDuration = 60

// Ein Cron-Lauf begrenzt sich selbst pro Nutzer — jeder Score ist ein
// KI-Aufruf (schnelles Scoring-Modell, Bruchteile eines Cents), der Rückstand
// heilt sich Nacht für Nacht.
const BATCH_LIMIT = 20
// Parallele KI-Aufrufe pro Chunk — genug Tempo, keine Provider-Überforderung
const CHUNK_SIZE = 5

// GET /api/cron/score — nächtlicher Drain (vercel.json cron). Vercel schickt
// `Authorization: Bearer $CRON_SECRET`, sobald die Env-Variable gesetzt ist.
// Ohne Secret antwortet die Route ehrlich mit 500 — Scoring läuft nie
// ungeschützt, und der Ausfall ist im Vercel-Log sichtbar statt still.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET ist nicht konfiguriert — der Cron-Drain bleibt gesperrt.' },
      { status: 500 }
    )
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  // Pro Nutzer sein eigenes Material: der Drain bewertet die Jobs eines Nutzers
  // nur gegen dessen Lebenslauf und mit dessen Provider — kein Mischmasch.
  const users = await prisma.user.findMany({
    select: {
      id: true,
      resumes: { where: { isActive: true }, select: { content: true }, take: 1 },
      settings: {
        select: {
          aiProvider: true,
          aiModel: true,
          nebiusApiKey: true,
          geminiApiKey: true,
          openaiApiKey: true,
          openrouterApiKey: true,
          ollamaUrl: true,
          minSalary: true,
          preferenceProfile: true,
        },
      },
      jobs: {
        where: { score: null, status: { notIn: [JobStatus.ARCHIVED, JobStatus.REJECTED] } },
        select: { id: true, title: true, description: true, score: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: BATCH_LIMIT,
      },
    },
  })

  let scored = 0
  let failed = 0
  let skipped = 0
  let remaining = 0

  for (const user of users) {
    const resume = user.resumes[0]
    if (!resume?.content) continue
    const settings = user.settings
    const { provider, model, apiKey, baseUrl } = aiConfigFromSettings(settings)
    const batch = pickUnscoredBatch(user.jobs, BATCH_LIMIT)
    remaining += Math.max(user.jobs.length - batch.length, 0)

    for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
      const chunk = batch.slice(i, i + CHUNK_SIZE)
      const results = await Promise.all(
        chunk.map(async (job) => {
          if (!job.description) return { job, result: null }
          try {
            const result = await scoreJob(
              job.description,
              resume.content,
              provider,
              model,
              apiKey,
              baseUrl,
              settings?.minSalary ?? null,
              parseStoredProfile(settings?.preferenceProfile),
              undefined, // deadline: Cron-Lauf hat eigene Budgetlogik
              job.title
            )
            return { job, result }
          } catch {
            return { job, result: null }
          }
        })
      )
      for (const { job, result } of results) {
        if (!job.description) {
          skipped += 1
          continue
        }
        if (!result || result.score === null) {
          failed += 1
          continue
        }
        await prisma.job.update({
          where: { id: job.id },
          data: scoreUpdatePayload(
            { score: result.score, reason: result.reason, strengths: result.strengths, gaps: result.gaps },
            HIGH_MATCH_THRESHOLD
          ),
        })
        scored += 1
      }
    }
  }

  return NextResponse.json({ scored, failed, skipped, remaining })
}
