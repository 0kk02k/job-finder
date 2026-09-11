import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { generateCoverLetter, aiConfigFromSettings } from '@/lib/ai'
import { anecdoteToPromptBlock, parseSkills, sanitizeNeedPayload } from '@/lib/anecdotes'
import { detectLanguage } from '@/lib/language'

// POST /api/coverletter — Anschreiben-Text aus dem echten Lebenslauf + dieser
// Stellenanzeige erzeugen (KI). Wird bewusst nicht persistiert: der Text gehört
// der Nutzerin — sie bearbeitet ihn hier und lädt das PDF selbst herunter
// (/api/pdf mit `content`). Kein stiller Fallback: schlägt die KI fehl,
// antwortet die Route mit einem ehrlichen Fehler statt eines Textes.
//
// Optional mit Anekdote: `anecdoteId` + `need` (die Mutmaßung aus dem Chooser).
// Dem Client wird nicht vertraut — Anekdote wird neu geladen, das Zitat erneut
// gegen den Anzeigentext verifiziert; ist es unbelegbar, webt die KI die
// Anekdote ohne Mutmaßung ein.
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  const userId = session.user.id

  const body = await request.json()
  const { jobId, anecdoteId, need } = body
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

  let anecdoteBlock: string | undefined
  if (anecdoteId) {
    const anecdote = await prisma.anecdote.findFirst({ where: { id: anecdoteId, userId } })
    if (!anecdote) {
      return NextResponse.json({ error: 'Anekdote nicht gefunden' }, { status: 404 })
    }
    const verifiedNeed = sanitizeNeedPayload(need, job.description ?? '')
    anecdoteBlock = anecdoteToPromptBlock(
      {
        title: anecdote.title,
        situation: anecdote.situation,
        action: anecdote.action,
        result: anecdote.result,
        skills: parseSkills(anecdote.skills),
      },
      verifiedNeed
    )
  }

  const cfg = aiConfigFromSettings(settings)
  try {
    // Das Anschreiben spricht die Sprache der Anzeige — nicht die des Lebenslaufs
    const language = detectLanguage(job.description ?? '')
    const text = await generateCoverLetter(
      resume.content,
      job.description ?? '',
      job.company || 'das Unternehmen',
      cfg.provider,
      cfg.model,
      cfg.apiKey,
      cfg.baseUrl,
      job.title,
      language,
      anecdoteBlock
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
