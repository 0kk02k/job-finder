import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { generateCoverLetter, aiConfigFromSettings } from '@/lib/ai'

// POST /api/coverletter — Anschreiben-Text aus dem echten Lebenslauf + dieser
// Stellenanzeige erzeugen (KI). Wird bewusst nicht persistiert: der Text gehört
// der Nutzerin — sie bearbeitet ihn hier und lädt das PDF selbst herunter
// (/api/pdf mit `content`). Kein stiller Fallback: schlägt die KI fehl,
// antwortet die Route mit einem ehrlichen Fehler statt eines Textes.
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  const userId = session.user.id

  const body = await request.json()
  const { jobId } = body
  if (!jobId) return NextResponse.json({ error: 'Job-ID erforderlich' }, { status: 400 })

  const [job, resume, settings] = await Promise.all([
    prisma.job.findFirst({ where: { id: jobId, userId } }),
    prisma.resume.findFirst({ where: { userId, isActive: true } }),
    prisma.userSettings.findUnique({ where: { userId } }),
  ])

  if (!job) {
    return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 })
  }
  if (!resume) {
    return NextResponse.json(
      { error: 'Kein Lebenslauf hinterlegt — lade zuerst deinen Lebenslauf hoch.' },
      { status: 409 }
    )
  }

  const cfg = aiConfigFromSettings(settings)
  try {
    const text = await generateCoverLetter(
      resume.content,
      job.description ?? '',
      job.company || 'das Unternehmen',
      cfg.provider,
      cfg.model,
      cfg.apiKey,
      cfg.baseUrl,
      job.title
    )
    return NextResponse.json({ text, source: 'ki' })
  } catch (error) {
    console.error('Cover letter generation error:', error)
    return NextResponse.json(
      { error: 'Die KI ist nicht erreichbar — es wurde kein Anschreiben erzeugt. Deine Daten sind unverändert.' },
      { status: 503 }
    )
  }
}
