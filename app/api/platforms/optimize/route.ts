import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { optimizeProfile, generateOptimizedSection } from '@/lib/platforms'

// POST /api/platforms/optimize - get AI profile optimization suggestions
export async function POST(request: NextRequest) {
  const userId = 'default'

  const body = await request.json()
  const { platform, targetJobs } = body

  if (!platform) {
    return NextResponse.json({ error: 'Platform required' }, { status: 400 })
  }

  // Get profile
  const profile = await prisma.platformProfile.findFirst({
    where: { userId, platform },
  })

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found. Sync first.' }, { status: 404 })
  }

  // Get user settings for AI provider
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  })

  // Reconstruct profile object
  const profileData = {
    id: profile.profileId,
    name: profile.name,
    headline: profile.headline || '',
    location: profile.location || '',
    about: profile.about || '',
    experience: JSON.parse(profile.experience || '[]'),
    education: JSON.parse(profile.education || '[]'),
    skills: JSON.parse(profile.skills || '[]'),
  }

  // Get optimization suggestions
  const optimization = await optimizeProfile(
    profileData,
    targetJobs || ['Software Engineer'],
    settings?.aiProvider || 'ollama'
  )

  // Save optimization suggestions
  await prisma.platformProfile.update({
    where: { id: profile.id },
    data: {
      optimization: JSON.stringify(optimization),
      updatedAt: new Date(),
    },
  })

  return NextResponse.json({
    profile: profileData,
    optimization,
  })
}

// PATCH /api/platforms/optimize/section - generate optimized section
export async function PATCH(request: NextRequest) {
  const userId = 'default'

  const body = await request.json()
  const { platform, section, targetJobs } = body

  if (!platform || !section) {
    return NextResponse.json({ error: 'Platform and section required' }, { status: 400 })
  }

  // Get profile
  const profile = await prisma.platformProfile.findFirst({
    where: { userId, platform },
  })

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Get current content based on section
  let currentContent = ''
  switch (section) {
    case 'headline':
      currentContent = profile.headline || ''
      break
    case 'about':
      currentContent = profile.about || ''
      break
    case 'experience':
      currentContent = profile.experience || ''
      break
    case 'skills':
      currentContent = profile.skills || ''
      break
  }

  // Generate optimized section
  const optimized = await generateOptimizedSection(
    section,
    currentContent,
    targetJobs || ['Software Engineer'],
    'ollama'
  )

  return NextResponse.json({
    section,
    current: currentContent,
    optimized,
  })
}

// GET /api/platforms/optimize - get saved optimization
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const platform = searchParams.get('platform')
  const userId = 'default'

  if (!platform) {
    return NextResponse.json({ error: 'Platform required' }, { status: 400 })
  }

  const profile = await prisma.platformProfile.findFirst({
    where: { userId, platform },
  })

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const optimization = profile.optimization ? JSON.parse(profile.optimization) : null

  return NextResponse.json({
    profile: {
      id: profile.profileId,
      name: profile.name,
      headline: profile.headline,
      about: profile.about,
      experience: JSON.parse(profile.experience || '[]'),
      education: JSON.parse(profile.education || '[]'),
      skills: JSON.parse(profile.skills || '[]'),
    },
    optimization,
  })
}
