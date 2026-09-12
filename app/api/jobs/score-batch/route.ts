import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { JobStatus } from '@prisma/client'
import { scoreJob, aiConfigFromSettings } from '@/lib/ai'
import { parseStoredProfile } from '@/lib/preferences'
import { HIGH_MATCH_THRESHOLD } from '@/lib/matching'
import { pickUnscoredBatch, scoreUpdatePayload } from '@/lib/scoring'

export const maxDuration = 60

// Ein Batch begrenzt sich selbst — jeder Score ist ein KI-Aufruf, und die Fläche
// looped über mehrere Batches, bis der Rückstand trocken ist oder abbricht.
const BATCH_LIMIT = 20
// Parallele KI-Aufrufe pro Chunk — genug Tempo, keine Provider-Überforderung
const CHUNK_SIZE = 5

// POST /api/jobs/score-batch - bewertet den ältesten unbewerteten Rückstand
// (max. BATCH_LIMIT pro Aufruf, ~1 KI-Aufruf pro Job). Antwortet mit gezählter
// Wahrheit: scored / failed / skipped / remaining — die Fläche zeigt Fortschritt
// daraus, nicht aus Annahmen.
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  const userId = session.user.id

  const body = await request.json().catch(() => undefined)
  const requested = Number((body as { limit?: unknown } | undefined)?.limit)
  const limit = Math.min(Math.max(Number.isFinite(requested) ? requested : BATCH_LIMIT, 1), 40)

  const resume = await prisma.resume.findFirst({ where: { userId, isActive: true } })
  if (!resume?.content) {
    return NextResponse.json(
      { error: 'Kein Lebenslauf hinterlegt — die KI bewertet nur gegen deinen Lebenslauf.' },
      { status: 400 }
    )
  }

  const settings = await prisma.userSettings.findUnique({ where: { userId } })
  const { provider, model, apiKey, baseUrl } = aiConfigFromSettings(settings)

  // Dieselbe Menge wie der „Unbewertet"-Filter auf /jobs: aktive Jobs ohne Score.
  // Auswahl über pickUnscoredBatch — dieselbe Reihenfolge-Regel wie getestet.
  const candidates = await prisma.job.findMany({
    where: { userId, score: null, status: { notIn: [JobStatus.ARCHIVED, JobStatus.REJECTED] } },
  })
  const batch = pickUnscoredBatch(candidates, limit)

  let scored = 0
  let failed = 0
  for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
    const chunk = batch.slice(i, i + CHUNK_SIZE)
    const results = await Promise.all(
      chunk.map(async (job) => {
        if (!job.description?.trim()) return 'skipped' as const
        try {
          const result = await scoreJob(
            job.description,
            resume.content,
            provider,
            model,
            apiKey,
            baseUrl,
            settings?.minSalary ?? null,
            // Nur zukünftige Bewertungen sehen das Profil — bestehende Scores bleiben
            parseStoredProfile(settings?.preferenceProfile)
          )
          if (result.score === null) return 'failed' as const
          await prisma.job.update({
            where: { id: job.id },
            // Explizit statt `result` als Ganzes: erst der Guard schmälert score zu number
            data: scoreUpdatePayload(
              { score: result.score, reason: result.reason, strengths: result.strengths, gaps: result.gaps },
              HIGH_MATCH_THRESHOLD
            ),
          })
          return 'scored' as const
        } catch {
          return 'failed' as const
        }
      })
    )
    for (const outcome of results) {
      if (outcome === 'scored') scored++
      else if (outcome === 'failed') failed++
    }
  }

  // Skipped zählt mit: ein Job ohne Beschreibung bleibt unbewertet, würde die
  // Fläche sonst aber endlos erneut anfordern.
  const skipped = batch.length - scored - failed
  const remaining = await prisma.job.count({
    where: { userId, score: null, status: { notIn: [JobStatus.ARCHIVED, JobStatus.REJECTED] } },
  })

  // Nichts bewertet und nichts übersprungen — die KI war komplett nicht erreichbar
  if (batch.length > 0 && scored === 0 && skipped === 0 && failed === batch.length) {
    return NextResponse.json(
      { error: 'Die KI ist nicht erreichbar — keine Bewertung gesetzt. Versuch es gleich noch einmal.' },
      { status: 503 }
    )
  }

  return NextResponse.json({ scored, failed, skipped, remaining })
}
