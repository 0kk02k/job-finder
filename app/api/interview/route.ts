import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import {
  interviewerReply,
  generateInsights,
  INTERVIEW_GUIDE,
  OPENING_MESSAGE,
  type InterviewMessage,
} from '@/lib/interview'

async function getAIConfig(userId: string) {
  const settings = await prisma.userSettings.findUnique({ where: { userId } })
  const provider = settings?.aiProvider || 'mistral'
  return {
    provider,
    model: settings?.aiModel || undefined,
    apiKey:
      provider === 'gemini'
        ? settings?.geminiApiKey || undefined
        : provider === 'openai'
          ? settings?.openaiApiKey || undefined
          : provider === 'openrouter'
            ? settings?.openrouterApiKey || undefined
            : provider === 'mistral'
              ? settings?.mistralApiKey || undefined
              : undefined,
    baseUrl: provider === 'ollama' ? settings?.ollamaUrl || undefined : undefined,
  }
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

// POST /api/interview - Session starten (ohne body) oder Nachricht senden ({ message })
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const body = await request.json().catch(() => ({}))
  const message = typeof body.message === 'string' ? body.message.trim() : ''

  let interview = await prisma.interviewSession.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  })

  // Start: neue Session mit statischer Eröffnungsnachricht
  if (!interview) {
    interview = await prisma.interviewSession.create({
      data: {
        userId,
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

  const completedIds = JSON.parse(interview.completedItems) as string[]

  const resume = await prisma.resume.findFirst({ where: { userId, isActive: true } })
  const config = await getAIConfig(userId)

  let reply: string
  let newlyCompleted: string[]
  try {
    ;({ reply, completed: newlyCompleted } = await interviewerReply(messages, completedIds, resume?.content ?? null, config))
  } catch (error) {
    console.error('Interviewer error:', error)
    return NextResponse.json({ error: 'KI nicht erreichbar — bitte später erneut versuchen.' }, { status: 502 })
  }

  const allCompleted = [...completedIds, ...newlyCompleted]
  const isDone = INTERVIEW_GUIDE.every((item) => allCompleted.includes(item.id))

  messages.push({ role: 'assistant', content: reply, ts: new Date().toISOString() })

  // Abschluss: alle Leitfaden-Punkte abgehakt → Insights erzeugen
  if (isDone) {
    const insights = await generateInsights(messages, config)
    interview = await prisma.interviewSession.update({
      where: { id: interview.id },
      data: {
        status: 'COMPLETED',
        completedItems: JSON.stringify(allCompleted),
        messages: JSON.stringify(messages),
        ...(insights && { insights: JSON.stringify(insights) }),
      },
    })
  } else {
    interview = await prisma.interviewSession.update({
      where: { id: interview.id },
      data: {
        completedItems: JSON.stringify(allCompleted),
        messages: JSON.stringify(messages),
      },
    })
  }

  return NextResponse.json(serialize(interview))
}

// DELETE /api/interview - aktive Session verwerfen (Neustart)
export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.interviewSession.deleteMany({
    where: { userId: session.user.id, status: 'ACTIVE' },
  })

  return NextResponse.json({ ok: true })
}
