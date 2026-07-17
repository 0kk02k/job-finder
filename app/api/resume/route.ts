import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

// GET /api/resume - get active resume
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const resume = await prisma.resume.findFirst({
    where: { userId, isActive: true },
  })

  return NextResponse.json(resume)
}

// POST /api/resume - create/update resume
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const body = await request.json()
  const { name, content } = body

  // Deactivate old resumes
  await prisma.resume.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false },
  })

  const resume = await prisma.resume.create({
    data: { userId, name, content, isActive: true },
  })

  return NextResponse.json(resume)
}
