import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PATCH /api/jobs/[id] - update job status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()
  const { status } = body

  const job = await prisma.job.update({
    where: { id: params.id },
    data: { status },
  })

  // Add activity
  await prisma.activity.create({
    data: {
      jobId: params.id,
      type: 'STATUS_CHANGE',
      description: `Status geändert zu ${status}`,
    },
  })

  return NextResponse.json(job)
}
