import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

// GET /api/settings - get user settings
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  let settings = await prisma.userSettings.findUnique({
    where: { userId },
  })

  // Create default settings if not exist
  if (!settings) {
    settings = await prisma.userSettings.create({
      data: { userId },
    })
  }

  return NextResponse.json(settings)
}

// PUT /api/settings - update settings
export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id
  const body = await request.json()

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: body,
    create: { userId, ...body },
  })

  return NextResponse.json(settings)
}
