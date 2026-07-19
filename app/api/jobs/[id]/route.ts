import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { JobStatus } from '@prisma/client'

const VALID_STATUSES = Object.values(JobStatus)

// GET /api/jobs/[id] - get single job details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { id } = await params
  const job = await prisma.job.findFirst({
    where: { id, userId: session.user.id },
    include: {
      activities: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!job) {
    return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 })
  }

  return NextResponse.json(job)
}

// PATCH /api/jobs/[id] - update job status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { status } = body

  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Ungültiger Status' }, { status: 400 })
  }

  // Only the owner may modify a job
  const existing = await prisma.job.findFirst({
    where: { id, userId: session.user.id },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 })
  }

  try {
    const job = await prisma.job.update({
      where: { id },
      data: { status },
    })

    // Add activity
    await prisma.activity.create({
      data: {
        jobId: id,
        type: 'STATUS_CHANGE',
        description: `Status geändert zu ${status}`,
      },
    })

    return NextResponse.json(job)
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 })
    }
    throw error
  }
}
