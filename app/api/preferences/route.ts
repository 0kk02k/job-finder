import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { aiConfigFromSettings } from '@/lib/ai'
import {
  PREFERENCE_GUIDE,
  PREFERENCE_OPENING_MESSAGE,
  parseStoredProfile,
  preferenceInterviewerReply,
  synthesizePreferenceProfile,
  type InterviewMessage,
} from '@/lib/preferences'

function serialize(session: {
  id: string
  status: string
  completedItems: string
  messages: string
  profile: string | null
  createdAt: Date
  updatedAt: Date
}) {
  const completedItems = JSON.parse(session.completedItems) as string[]
  return {
    id: session.id,
    status: session.status,
    completedItems,
    guide: PREFERENCE_GUIDE.map((item) => ({
      ...item,
      done: completedItems.includes(item.id),
    })),
    messages: JSON.parse(session.messages) as InterviewMessage[],
    profile: parseStoredProfile(session.profile),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  }
}

// GET /api/preferences            — letzte Session (+ Guide mit done-Flags, + Profil)
// GET /api/preferences?light=1    — nur Flags: billig fürs Dashboard-Onboarding
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  if (request.nextUrl.searchParams.get('light')) {
    const [settings, active] = await Promise.all([
      prisma.userSettings.findUnique({ where: { userId }, select: { preferenceProfile: true } }),
      prisma.preferenceSession.findFirst({
        where: { userId, status: 'ACTIVE' },
        select: { id: true },
      }),
    ])
    return NextResponse.json({ hasProfile: !!settings?.preferenceProfile, hasActiveSession: !!active })
  }

  const [latest, settings] = await Promise.all([
    prisma.preferenceSession.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.userSettings.findUnique({ where: { userId }, select: { preferenceProfile: true } }),
  ])

  return NextResponse.json({
    profile: parseStoredProfile(settings?.preferenceProfile),
    session: latest ? serialize(latest) : null,
  })
}

// POST /api/preferences — Session starten (ohne body), Nachricht senden
// ({ message }) oder aus dem fertigen Transkript neu synthetisieren
// ({ resynthesize: true }).
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const body = await request.json().catch(() => ({})) as { message?: unknown; resynthesize?: unknown }

  // --- Neu synthetisieren: Transkript der COMPLETED-Session, kein Chat-Zug ---
  if (body.resynthesize === true) {
    const done = await prisma.preferenceSession.findFirst({
      where: { userId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
    })
    if (!done) {
      return NextResponse.json({ error: 'Kein abgeschlossenes Gespräch vorhanden.' }, { status: 400 })
    }
    const settings = await prisma.userSettings.findUnique({ where: { userId } })
    const profile = await synthesizePreferenceProfile(
      JSON.parse(done.messages) as InterviewMessage[],
      aiConfigFromSettings(settings)
    )
    if (!profile) {
      return NextResponse.json(
        { error: 'Die KI konnte kein gültiges Profil aus dem Gespräch ableiten — bitte erneut versuchen.' },
        { status: 502 }
      )
    }
    const profileJson = JSON.stringify(profile)
    await prisma.$transaction([
      prisma.preferenceSession.update({
        where: { id: done.id },
        data: { profile: profileJson },
      }),
      prisma.userSettings.upsert({
        where: { userId },
        update: { preferenceProfile: profileJson },
        create: { userId, preferenceProfile: profileJson },
      }),
    ])
    return NextResponse.json({ profile, synthesisError: false })
  }

  const message = typeof body.message === 'string' ? body.message.trim() : ''

  let chat = await prisma.preferenceSession.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  })

  // Start: neue Session mit statischer Eröffnungsnachricht — ohne Lebenslauf
  // gibt es nichts, worauf sich das Gespräch bezieht, also ehrlich blocken.
  if (!chat) {
    const resume = await prisma.resume.findFirst({ where: { userId, isActive: true }, select: { id: true } })
    if (!resume) {
      return NextResponse.json(
        { error: 'Lade zuerst einen Lebenslauf hoch — das Gespräch bezieht sich darauf.' },
        { status: 400 }
      )
    }
    chat = await prisma.preferenceSession.create({
      data: {
        userId,
        messages: JSON.stringify([
          { role: 'assistant', content: PREFERENCE_OPENING_MESSAGE, ts: new Date().toISOString() },
        ]),
      },
    })
    // Ohne Nachricht nur starten; mit Nachricht direkt unten beantworten
    if (!message) return NextResponse.json(serialize(chat))
  }

  if (!message) {
    return NextResponse.json({ error: 'Nachricht erforderlich' }, { status: 400 })
  }

  const messages = JSON.parse(chat.messages) as InterviewMessage[]
  messages.push({ role: 'user', content: message, ts: new Date().toISOString() })

  const completedIds = JSON.parse(chat.completedItems) as string[]

  const [resume, settings] = await Promise.all([
    prisma.resume.findFirst({ where: { userId, isActive: true } }),
    prisma.userSettings.findUnique({ where: { userId } }),
  ])

  let reply: string
  let newlyCompleted: string[]
  try {
    ;({ reply, completed: newlyCompleted } = await preferenceInterviewerReply(
      messages,
      completedIds,
      resume?.content ?? null,
      aiConfigFromSettings(settings)
    ))
  } catch (error) {
    console.error('Präferenz-Berater Fehler:', error)
    return NextResponse.json({ error: 'KI nicht erreichbar — bitte später erneut versuchen.' }, { status: 502 })
  }

  const allCompleted = [...completedIds, ...newlyCompleted]
  const isDone = PREFERENCE_GUIDE.every((item) => allCompleted.includes(item.id))

  messages.push({ role: 'assistant', content: reply, ts: new Date().toISOString() })

  // Abschluss: alle Themen abgehakt → Profil synthetisieren und an EINER Stelle
  // (UserSettings.preferenceProfile) ablegen. Schlägt die Synthese fehl, ist
  // das Gespräch trotzdem fertig — die Antwort meldet es ehrlich, „Erneut
  // versuchen" läuft über {resynthesize: true}.
  let synthesisError = false
  let profileJson: string | null = null
  if (isDone) {
    const profile = await synthesizePreferenceProfile(messages, aiConfigFromSettings(settings))
    if (profile) {
      profileJson = JSON.stringify(profile)
    } else {
      synthesisError = true
    }
  }

  chat = await prisma.preferenceSession.update({
    where: { id: chat.id },
    data: {
      ...(isDone && { status: 'COMPLETED' }),
      completedItems: JSON.stringify(allCompleted),
      messages: JSON.stringify(messages),
      ...(profileJson && { profile: profileJson }),
    },
  })

  if (profileJson) {
    await prisma.userSettings.upsert({
      where: { userId },
      update: { preferenceProfile: profileJson },
      create: { userId, preferenceProfile: profileJson },
    })
  }

  return NextResponse.json({ ...serialize(chat), synthesisError })
}

// DELETE /api/preferences             — aktive Session verwerfen (Neustart)
// DELETE /api/preferences?scope=profile — zusätzlich das gespeicherte Profil löschen
export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  await prisma.preferenceSession.deleteMany({
    where: { userId, status: 'ACTIVE' },
  })

  if (request.nextUrl.searchParams.get('scope') === 'profile') {
    await prisma.userSettings.updateMany({
      where: { userId },
      data: { preferenceProfile: null },
    })
  }

  return NextResponse.json({ ok: true })
}
