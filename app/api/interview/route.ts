import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { aiConfigFromSettings } from '@/lib/ai'
import { parseStoredProfile } from '@/lib/preference-profile'
import {
  interviewerReply,
  generateInsights,
  coveredAgendaIds,
  anecdoteFromRow,
  INTERVIEW_GUIDE,
  OPENING_MESSAGE,
  type AnecdoteRef,
  type InterviewMessage,
} from '@/lib/interview'

// Der Abschluss-Turn enthält die Insights auf dem Standard-Modell — der braucht
// bewusst Kopfraum; ohne Limit lief die Function bis zum Runtime-Timeout.
export const maxDuration = 300

// Gesamtfrist pro Request: bis zu fünf guarded KI-Calls (2 × Klassifikation/
// Antwort am Ende, Insights) — die Einzelfristen (60s/120s + Retry) werden an
// dieses Budget gekappt, statt den Request an die 300s der Runtime treiben.
const REQUEST_DEADLINE_MS = 280_000

async function loadAnecdotes(userId: string): Promise<AnecdoteRef[]> {
  const rows = await prisma.anecdote.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 6,
  })
  return rows.map(anecdoteFromRow)
}

function serialize(session: {
  id: string
  status: string
  completedItems: string
  messages: string
  insights: string | null
  personalityType: string | null
  createdAt: Date
  updatedAt: Date
}) {
  const completedItems = JSON.parse(session.completedItems) as string[]
  return {
    id: session.id,
    status: session.status,
    completedItems,
    guide: INTERVIEW_GUIDE.map((item) => ({
      ...item,
      done: completedItems.includes(item.id),
    })),
    messages: JSON.parse(session.messages) as InterviewMessage[],
    insights: session.insights ? JSON.parse(session.insights) : null,
    personalityType: session.personalityType,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  }
}

// GET /api/interview - letzte Session des Users (aktiv oder abgeschlossen)
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const interview = await prisma.interviewSession.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(interview ? serialize(interview) : null)
}

// POST /api/interview — Session starten (ohne body), Nachricht senden
// ({ message }), aktiv abschließen ({ finish: true }) oder bei einer
// abgeschlossenen Session ohne Auswertung diese erneut ableiten
// ({ resynthesize: true }).
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id
  const deadline = Date.now() + REQUEST_DEADLINE_MS

  const body = (await request.json().catch(() => ({}))) as {
    message?: unknown
    finish?: unknown
    resynthesize?: unknown
  }

  // --- Neu ableiten: Auswertung einer COMPLETED-Session nachholen ---
  // Bewusst möglich, weil der Abschluss ehrlich mit null-Auswertung
  // durchgeht, wenn die KI gerade nicht liefert — das Transkript ist komplett,
  // ein erneuter Versuch reicht, kein zweites Interview.
  if (body.resynthesize === true) {
    const done = await prisma.interviewSession.findFirst({
      where: { userId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
    })
    if (!done) {
      return NextResponse.json({ error: 'Kein abgeschlossenes Interview vorhanden.' }, { status: 400 })
    }
    const [settings, anecdotes] = await Promise.all([
      prisma.userSettings.findUnique({ where: { userId } }),
      loadAnecdotes(userId),
    ])
    const insights = await generateInsights(
      JSON.parse(done.messages) as InterviewMessage[],
      aiConfigFromSettings(settings),
      { anecdotes, deadline }
    )
    if (!insights) {
      return NextResponse.json(
        { error: 'Die KI konnte keine Auswertung erstellen — versuch es gleich nochmal.' },
        { status: 502 }
      )
    }
    const updated = await prisma.interviewSession.update({
      where: { id: done.id },
      data: { insights: JSON.stringify(insights) },
    })
    return NextResponse.json(serialize(updated))
  }

  // --- Abschließen: aktives Interview beenden, Auswertung aus dem Bestand ---
  // Bewusst auch mit offenen Themen möglich: Der Klassifikator hakt nachsich-
  // tig ab, und niemand darf in einer ACTIVE-Session hängen bleiben, deren Ende
  // nur der Abhak-Stand bestimmt. Offene Themen bleiben ehrlich offen; schlägt
  // die Auswertung fehl, meldet die Antwort es (insightsError) und die Seite
  // bietet „Erneut versuchen" über { resynthesize: true }.
  if (body.finish === true) {
    const active = await prisma.interviewSession.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    })
    if (!active) {
      return NextResponse.json({ error: 'Kein aktives Interview zum Abschließen.' }, { status: 400 })
    }
    if (!JSON.parse(active.messages).some((m: { role: string }) => m.role === 'user')) {
      return NextResponse.json(
        { error: 'Das Interview hat gerade erst begonnen — es gibt noch nichts zu verwerten.' },
        { status: 400 }
      )
    }
    const [settings, anecdotes] = await Promise.all([
      prisma.userSettings.findUnique({ where: { userId } }),
      loadAnecdotes(userId),
    ])
    const insights = await generateInsights(
      JSON.parse(active.messages) as InterviewMessage[],
      aiConfigFromSettings(settings),
      { anecdotes, deadline }
    )
    const updated = await prisma.interviewSession.update({
      where: { id: active.id },
      data: {
        status: 'COMPLETED',
        ...(insights && { insights: JSON.stringify(insights) }),
      },
    })
    return NextResponse.json({ ...serialize(updated), insightsError: !insights })
  }

  const message = typeof body.message === 'string' ? body.message.trim() : ''

  let interview = await prisma.interviewSession.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  })

  // Zwei-Phasen-Kontext: Präferenz-Profil und Anekdoten laden. Beide fließen
  // in den Prompt (geklärte Themen nicht erneut fragen, Anekdoten als
  // STAR-Rohmaterial) und deckeln die Agenda: was davon abgedeckt wird, startet
  // als abgehakt statt als offen.
  const [resume, settings, anecdotes] = await Promise.all([
    prisma.resume.findFirst({ where: { userId, isActive: true } }),
    prisma.userSettings.findUnique({ where: { userId } }),
    loadAnecdotes(userId),
  ])
  const profile = parseStoredProfile(settings?.preferenceProfile)
  const covered = coveredAgendaIds(profile, anecdotes)
  const context = { preferenceProfile: profile, anecdotes }

  // Start: neue Session mit statischer Eröffnungsnachricht
  if (!interview) {
    interview = await prisma.interviewSession.create({
      data: {
        userId,
        completedItems: JSON.stringify(covered),
        messages: JSON.stringify([
          { role: 'assistant', content: OPENING_MESSAGE, ts: new Date().toISOString() },
        ]),
      },
    })
    // Ohne Nachricht nur starten; mit Nachricht direkt weiter unten beantworten
    if (!message) return NextResponse.json(serialize(interview))
  }

  if (!message) {
    return NextResponse.json({ error: 'Nachricht erforderlich' }, { status: 400 })
  }

  const messages = JSON.parse(interview.messages) as InterviewMessage[]
  messages.push({ role: 'user', content: message, ts: new Date().toISOString() })

  // Ältere Sessions (vor dem Zwei-Phasen-Flow) holen die geklärten Punkte bei
  // der nächsten Nachricht einfach nach — persistiert wird der gemergte Stand.
  const completedIds = [
    ...new Set([...(JSON.parse(interview.completedItems) as string[]), ...covered]),
  ]

  let reply: string
  let newlyCompleted: string[]
  try {
    ;({ reply, completed: newlyCompleted } = await interviewerReply(
      messages,
      completedIds,
      resume?.content ?? null,
      aiConfigFromSettings(settings),
      { context, deadline }
    ))
  } catch (error) {
    console.error('Interviewer error:', error)
    return NextResponse.json({ error: 'Die KI antwortet gerade nicht — versuch es gleich nochmal.' }, { status: 502 })
  }

  const allCompleted = [...completedIds, ...newlyCompleted]
  const isDone = INTERVIEW_GUIDE.every((item) => allCompleted.includes(item.id))

  messages.push({ role: 'assistant', content: reply, ts: new Date().toISOString() })

  // Abschluss: alle Leitfaden-Punkte abgehakt → Auswertung erzeugen
  let insightsError = false
  if (isDone) {
    const insights = await generateInsights(messages, aiConfigFromSettings(settings), {
      anecdotes,
      deadline,
    })
    interview = await prisma.interviewSession.update({
      where: { id: interview.id },
      data: {
        status: 'COMPLETED',
        completedItems: JSON.stringify(allCompleted),
        messages: JSON.stringify(messages),
        ...(insights && { insights: JSON.stringify(insights) }),
      },
    })
    insightsError = !insights
  } else {
    interview = await prisma.interviewSession.update({
      where: { id: interview.id },
      data: {
        completedItems: JSON.stringify(allCompleted),
        messages: JSON.stringify(messages),
      },
    })
  }

  return NextResponse.json({ ...serialize(interview), insightsError })
}

// DELETE /api/interview - Session verwerfen (Neustart)
export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Der Neustart-Button steht in beiden Ansichten (aktiv und abgeschlossen) —
  // „Neues Interview starten" muss auch eine COMPLETED-Session wirklich
  // verwerfen, sonst überlebt die alte Akte den Neustart und liegt beim
  // nächsten GET wieder obenauf.
  await prisma.interviewSession.deleteMany({
    where: { userId: session.user.id },
  })

  return NextResponse.json({ ok: true })
}
