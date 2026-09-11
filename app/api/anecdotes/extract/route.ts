import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { aiConfigFromSettings, generateAnecdoteProposals } from '@/lib/ai'
import { sanitizeExtractedProposals } from '@/lib/anecdotes'

// POST /api/anecdotes/extract — Geschichten formen, aber nichts speichern:
// was die KI vorschlägt, bleibt Vorschlag, bis der Nutzer eine Karte bestätigt.
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const body = await request.json()
  const answers = Array.isArray(body.answers)
    ? body.answers.filter((a: unknown): a is string => typeof a === 'string' && a.trim().length > 0)
    : []
  if (answers.length === 0) {
    return NextResponse.json({ error: 'Es gibt nichts zu formen — erzähl zuerst etwas.' }, { status: 400 })
  }

  const settings = await prisma.userSettings.findUnique({ where: { userId: session.user.id } })
  const cfg = aiConfigFromSettings(settings)
  try {
    const raw = await generateAnecdoteProposals(answers, cfg.provider, cfg.model, cfg.apiKey, cfg.baseUrl)
    return NextResponse.json({ proposals: sanitizeExtractedProposals(raw) })
  } catch (error) {
    console.error('Anecdote extraction error:', error)
    return NextResponse.json(
      { error: 'Die KI ist nicht erreichbar — deine Antworten bleiben im Formular, nichts ist verloren.' },
      { status: 503 }
    )
  }
}
