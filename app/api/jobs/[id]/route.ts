import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/jobs/[id] - get single job details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      activities: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  return NextResponse.json(job)
}

// PATCH /api/jobs/[id] - update job status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const { status } = body

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
}
