import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/resume - get active resume
export async function GET() {
  const userId = 'default' // ponytail: simple auth

  const resume = await prisma.resume.findFirst({
    where: { userId, isActive: true },
  })

  return NextResponse.json(resume)
}

// POST /api/resume - create/update resume
export async function POST(request: NextRequest) {
  const userId = 'default'

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
