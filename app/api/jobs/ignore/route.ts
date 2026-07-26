import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

// POST /api/jobs/ignore - hide a search result by marking it ARCHIVED.
// Upserts by URL so results that were never saved to the job list
// can be ignored too (they stay out of future search results).
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const body = await request.json()
  const { url, title, company, location, description } = body

  if (!url) {
    return NextResponse.json({ error: 'URL erforderlich' }, { status: 400 })
  }

  const existing = await prisma.job.findUnique({
    where: { userId_url: { userId, url } },
    select: { status: true },
  })

  // Never clobber pipeline states like APPLIED/INTERVIEW on ignore
  const archivable = !existing || ['DISCOVERED', 'SCORED', 'HIGH_MATCH'].includes(existing.status)

  const job = await prisma.job.upsert({
    where: { userId_url: { userId, url } },
    update: archivable ? { status: 'ARCHIVED' } : {},
    create: {
      userId,
      title: title || 'Unbekannt',
      company: company || null,
      location: location || null,
      description: description || '',
      url,
      status: 'ARCHIVED',
    },
  })

  if (archivable) {
    await prisma.activity.create({
      data: {
        jobId: job.id,
        type: 'STATUS_CHANGE',
        description: 'Status geändert zu ARCHIVED',
      },
    })
  }

  return NextResponse.json(job)
}
