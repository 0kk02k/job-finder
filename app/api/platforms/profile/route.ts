import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

// GET /api/platforms/profile?platform=linkedin - get stored profile
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const { searchParams } = new URL(request.url)
  const platform = searchParams.get('platform')

  const where = platform ? { userId, platform } : { userId }
  const profiles = await prisma.platformProfile.findMany({ where })

  return NextResponse.json(profiles.length > 0 ? profiles : [])
}

// PUT /api/platforms/profile - save manual profile data
export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const body = await request.json()
  const { platform, name, headline, about, location, skills } = body

  if (!platform || !name) {
    return NextResponse.json({ error: 'Platform und Name erforderlich' }, { status: 400 })
  }

  const profileId = `manual-${userId}`

  await prisma.platformProfile.upsert({
    where: { platform_profileId: { platform, profileId } },
    update: {
      name,
      headline: headline || null,
      about: about || null,
      location: location || null,
      skills: skills ? JSON.stringify(skills) : null,
      lastSyncAt: new Date(),
    },
    create: {
      userId,
      platform,
      profileId,
      name,
      headline: headline || null,
      about: about || null,
      location: location || null,
      skills: skills ? JSON.stringify(skills) : null,
      lastSyncAt: new Date(),
    },
  })

  return NextResponse.json({ success: true })
}
