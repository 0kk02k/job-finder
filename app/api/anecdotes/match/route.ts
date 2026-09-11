import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { aiConfigFromSettings, matchAnecdotesForAd } from '@/lib/ai'
import { parseSkills, sanitizeMatches, sanitizeNeeds } from '@/lib/anecdotes'

// POST /api/anecdotes/match — das zweistufige Lesen (Spec): Mutmaßungen über
// nicht-technische Bedürfnisse, jede mit wörtlicher, verifizierter Zitatstelle,
// plus Rangliste der passenden Anekdoten. KI-Ausfall → 503; die Fläche zeigt
// dann die Sammlung unrangiert zum Selbstwählen — keine Sperre.
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  const userId = session.user.id

  const body = await request.json()
  const { jobId } = body
  if (!jobId) return NextResponse.json({ error: 'Job-ID erforderlich' }, { status: 400 })

  const [job, anecdotes, settings] = await Promise.all([
    prisma.job.findFirst({ where: { id: jobId, userId } }),
    prisma.anecdote.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.userSettings.findUnique({ where: { userId } }),
  ])
  if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 })
  if (anecdotes.length === 0) return NextResponse.json({ needs: [], matches: [] })
  if (!job.description) {
    return NextResponse.json(
      { error: 'Dieser Job hat keine Beschreibung — es gibt nichts zwischen den Zeilen.' },
      { status: 400 }
    )
  }

  const cfg = aiConfigFromSettings(settings)
  try {
    const raw = (await matchAnecdotesForAd(
      job.description,
      anecdotes.map((a) => ({
        id: a.id,
        title: a.title,
        situation: a.situation,
        action: a.action,
        result: a.result,
        skills: parseSkills(a.skills),
      })),
      cfg.provider,
      cfg.model,
      cfg.apiKey,
      cfg.baseUrl
    )) as { needs?: unknown; matches?: unknown }
    const needs = sanitizeNeeds(raw.needs, job.description)
    const matches = sanitizeMatches(
      raw.matches,
      anecdotes.map((a) => a.id),
      needs.length
    )
    return NextResponse.json({ needs, matches })
  } catch (error) {
    console.error('Anecdote match error:', error)
    return NextResponse.json(
      { error: 'Die Rangliste ist gerade nicht erreichbar — du kannst selbst wählen.' },
      { status: 503 }
    )
  }
}
