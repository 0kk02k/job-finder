import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { sanitizeSkillsInput } from '@/lib/anecdotes'

// Titel, Situation, Handlung, Ergebnis: eine Geschichte braucht alle vier.
// Skills kommen als Array herein und werden als JSON-String gelagert (wie
// matchDetails beim Job).
function storyFields(body: Record<string, unknown>):
  | { error: string }
  | { values: { title: string; situation: string; action: string; result: string } } {
  const values = {
    title: typeof body.title === 'string' ? body.title.trim() : '',
    situation: typeof body.situation === 'string' ? body.situation.trim() : '',
    action: typeof body.action === 'string' ? body.action.trim() : '',
    result: typeof body.result === 'string' ? body.result.trim() : '',
  }
  if (!values.title || !values.situation || !values.action || !values.result) {
    return { error: 'Titel, Situation, Handlung und Ergebnis werden gebraucht — ohne sie ist es keine Geschichte.' }
  }
  return { values }
}

// GET /api/anecdotes — die Sammlung, jüngste zuerst
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  const anecdotes = await prisma.anecdote.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(anecdotes)
}

// POST /api/anecdotes — speichern geht nur bestätigt: Extraktions-Vorschläge
// leben als Client-State, bis der Nutzer eine Karte übernimmt.
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  const body = (await request.json()) as Record<string, unknown>
  const result = storyFields(body)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  const anecdote = await prisma.anecdote.create({
    data: {
      userId: session.user.id,
      ...result.values,
      skills: JSON.stringify(sanitizeSkillsInput(body.skills)),
      source: body.source === 'interview' ? 'interview' : 'manuell',
    },
  })
  return NextResponse.json(anecdote, { status: 201 })
}
