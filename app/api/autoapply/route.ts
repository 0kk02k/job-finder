import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { applyIndeed, applyGeneric, batchApply } from '@/lib/autoapply'

// POST /api/autoapply - apply to a job automatically
export async function POST(request: NextRequest) {
  const userId = 'default'

  const body = await request.json()
  const { jobId, dryRun = false } = body

  if (!jobId) {
    return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
  }

  // Get job details
  const job = await prisma.job.findUnique({
    where: { id: jobId },
  })

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // Get user resume for personal info
  const resume = await prisma.resume.findFirst({
    where: { userId, isActive: true },
  })

  if (!resume) {
    return NextResponse.json({ error: 'Resume required' }, { status: 400 })
  }

  // Get user settings
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  })

  // Mock personal info (in real app, this would come from user profile)
  const config = {
    resumePath: '/tmp/resume.pdf', // Would need to be generated first
    coverLetterPath: '/tmp/cover.pdf',
    personalInfo: {
      firstName: 'Max',
      lastName: 'Mustermann',
      email: 'max@example.com',
      phone: '+49 123 456789',
    },
    experience: [],
    education: [],
    skills: [],
  }

  if (dryRun) {
    // Dry run - show what would happen without applying
    return NextResponse.json({
      dryRun: true,
      job: {
        title: job.title,
        company: job.company,
        url: job.url,
      },
      steps: [
        'Navigate to job page',
        'Click apply button',
        'Fill personal information',
        'Upload resume',
        'Fill experience',
        'Fill education',
        'Submit application',
      ],
      message: 'Dry run completed. No application submitted.',
    })
  }

  // Determine platform from URL
  const platform = job.url.includes('indeed') ? 'indeed' : 'generic'

  let result
  if (platform === 'indeed') {
    result = await applyIndeed(job.url, config)
  } else {
    result = await applyGeneric(job.url, config)
  }

  // Update job status
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: result.success ? 'APPLIED' : 'DISCOVERED',
      appliedAt: result.submittedAt,
    },
  })

  // Add activity log
  await prisma.activity.create({
    data: {
      jobId,
      type: 'STATUS_CHANGE',
      description: result.success ? 'Auto-Apply erfolgreich' : `Auto-Apply fehlgeschlagen: ${result.error}`,
      metadata: JSON.stringify(result),
    },
  })

  return NextResponse.json(result)
}

// GET /api/autoapply - get auto-apply status/history
export async function GET() {
  // Return recent auto-apply attempts
  const activities = await prisma.activity.findMany({
    where: { type: 'STATUS_CHANGE' },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  return NextResponse.json({ activities })
}
