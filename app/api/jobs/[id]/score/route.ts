import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { scoreJob, aiConfigFromSettings } from '@/lib/ai'
import { parseStoredProfile } from '@/lib/preferences'
import { HIGH_MATCH_THRESHOLD } from '@/lib/matching'
import { scoreUpdatePayload } from '@/lib/scoring'

export const maxDuration = 60

// POST /api/jobs/[id]/score - einen einzelnen Job jetzt gegen den Lebenslauf bewerten
// lassen. Bisher entstand ein Score ausschließlich bei der Suche (die ersten 15 Treffer
// pro Lauf) — manuell hinzugefügte oder darüber hinaus gefundene Jobs blieben dauerhaft
// ohne Bewertung. Dasselbe Persistenzverhalten wie die Suche: scoreUpdatePayload.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { id } = await params
  const job = await prisma.job.findFirst({ where: { id, userId: session.user.id } })
  if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 })

  if (!job.description?.trim()) {
    return NextResponse.json(
      { error: 'Dieser Job hat keine Beschreibung — ohne Text kann die KI nichts bewerten.' },
      { status: 400 }
    )
  }

  const resume = await prisma.resume.findFirst({
    where: { userId: session.user.id, isActive: true },
  })
  if (!resume?.content) {
    return NextResponse.json(
      { error: 'Kein Lebenslauf hinterlegt — die KI bewertet nur gegen deinen Lebenslauf.' },
      { status: 400 }
    )
  }

  const settings = await prisma.userSettings.findUnique({ where: { userId: session.user.id } })
  const { provider, model, apiKey, baseUrl } = aiConfigFromSettings(settings)

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
      parseStoredProfile(settings?.preferenceProfile),
      undefined, // deadline: Einzelscore hat keine Gesamtfrist
      job.title
    )
    // Ehrlich statt erfunden: ohne erreichbare KI gibt es keinen Score (Produktprinzip)
    if (result.score === null) {
      return NextResponse.json(
        { error: 'Die KI konnte keine Bewertung berechnen — der Score bleibt offen.' },
        { status: 503 }
      )
    }

    const updated = await prisma.job.update({
      where: { id },
      // Explizit statt `result` als Ganzes: ScoreResult.score ist `number | null`,
      // erst der Guard oben schmälert den Lesezugriff auf number
      data: scoreUpdatePayload(
        { score: result.score, reason: result.reason, strengths: result.strengths, gaps: result.gaps },
        HIGH_MATCH_THRESHOLD
      ),
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json(
      { error: 'Die KI ist nicht erreichbar — kein Score gesetzt. Versuch es gleich noch einmal.' },
      { status: 503 }
    )
  }
}
