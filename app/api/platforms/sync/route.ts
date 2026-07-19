import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { encrypt } from '@/lib/crypto'
import { syncLinkedInProfile, syncXINGProfile, syncStepStoneProfile } from '@/lib/platforms'

// POST /api/platforms/sync - sync profile from LinkedIn or StepStone
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const body = await request.json()
  const { platform, credentials } = body

  if (!platform || !credentials) {
    return NextResponse.json({ error: 'Platform and credentials required' }, { status: 400 })
  }

  // Save credentials (password encrypted at rest)
  const savedCreds = await prisma.platformCredential.upsert({
    where: {
      userId_platform: { userId, platform },
    },
    update: {
      email: credentials.email,
      encryptedPassword: encrypt(credentials.password),
      updatedAt: new Date(),
    },
    create: {
      userId,
      platform,
      email: credentials.email,
      encryptedPassword: encrypt(credentials.password),
    },
  })

  // Sync profile
  let profile
  try {
    if (platform === 'linkedin') {
      profile = await syncLinkedInProfile({ platform, ...credentials })
    } else if (platform === 'xing') {
      profile = await syncXINGProfile({ platform, ...credentials })
    } else if (platform === 'stepstone') {
      profile = await syncStepStoneProfile({ platform, ...credentials })
    } else if (platform === 'indeed' || platform === 'glassdoor') {
      return NextResponse.json({ error: `${platform} has no profile sync (use for job search only)` }, { status: 400 })
    } else {
      return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 })
    }

    if (!profile) {
      // Update sync status to failed
      await prisma.platformCredential.update({
        where: { id: savedCreds.id },
        data: { syncStatus: 'failed' },
      })
      return NextResponse.json({ error: 'Failed to sync profile' }, { status: 500 })
    }

    // Normalize profile fields for storage (StepStone has different shape)
    const profileName = 'firstName' in profile
      ? `${profile.firstName} ${profile.lastName}`.trim()
      : profile.name
    const profileHeadline = 'firstName' in profile ? '' : profile.headline || ''
    const profileAbout = 'firstName' in profile ? '' : profile.about || ''
    const profileExperience = 'firstName' in profile ? profile.experiences : profile.experience || []

    // Save profile
    await prisma.platformProfile.upsert({
      where: {
        userId_platform_profileId: {
          userId,
          platform,
          profileId: profile.id || 'unknown',
        },
      },
      update: {
        name: profileName,
        headline: profileHeadline,
        about: profileAbout,
        location: profile.location || '',
        experience: JSON.stringify(profileExperience),
        education: JSON.stringify(profile.education || []),
        skills: JSON.stringify(profile.skills || []),
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      },
      create: {
        userId,
        platform,
        profileId: profile.id || 'unknown',
        name: profileName,
        headline: profileHeadline,
        about: profileAbout,
        location: profile.location || '',
        experience: JSON.stringify(profileExperience),
        education: JSON.stringify(profile.education || []),
        skills: JSON.stringify(profile.skills || []),
        lastSyncAt: new Date(),
      },
    })

    // Update sync status to success
    await prisma.platformCredential.update({
      where: { id: savedCreds.id },
      data: { syncStatus: 'success', lastSyncAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      profile,
      message: 'Profile synced successfully',
    })
  } catch (error) {
    console.error('Sync error:', error)
    await prisma.platformCredential.update({
      where: { id: savedCreds.id },
      data: { syncStatus: 'failed' },
    })
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}

// GET /api/platforms/sync - get sync status
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const credentials = await prisma.platformCredential.findMany({
    where: { userId },
    select: {
      id: true,
      userId: true,
      platform: true,
      email: true,
      twoFactorEnabled: true,
      lastSyncAt: true,
      syncStatus: true,
      createdAt: true,
      updatedAt: true,
      // encryptedPassword wird nie ans Frontend gesendet
    },
  })

  const profiles = await prisma.platformProfile.findMany({
    where: { userId },
  })

  return NextResponse.json({
    credentials,
    profiles,
  })
}
