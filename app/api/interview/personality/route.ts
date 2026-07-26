import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

const TYPE_PATTERN = /^[EI][NS][TF][JP]-[AT]$/

// POST /api/interview/personality - 16Personalities-Typ hinterlegen.
// Wird auf der letzten Session gespeichert; falls noch keine existiert,
// wird eine leere (abgeschlossene) Session als Akten-Container angelegt.
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const body = await request.json()
  const type = typeof body.type === 'string' ? body.type.trim().toUpperCase() : ''

  if (!TYPE_PATTERN.test(type)) {
    return NextResponse.json({ error: 'Ungültiger Typ — Format z.B. INFJ-T' }, { status: 400 })
  }

  const latest = await prisma.interviewSession.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  const saved = latest
    ? await prisma.interviewSession.update({
        where: { id: latest.id },
        data: { personalityType: type },
      })
    : await prisma.interviewSession.create({
        data: { userId, status: 'COMPLETED', messages: '[]', personalityType: type },
      })

  return NextResponse.json({ personalityType: saved.personalityType })
}
