import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { scrapeJobUrl } from '@/lib/scrapers'
import { scoreJob } from '@/lib/ai'

// GET /api/jobs - list all jobs for user
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const jobs = await prisma.job.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(jobs)
}

// POST /api/jobs - add new job (URL or manual)
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const body = await request.json()
  const { url, title, company, location, description } = body

  let jobData = { title, company, location, description, url }

  // If URL provided, try to scrape
  if (url && (!title || !description)) {
    const scraped = await scrapeJobUrl(url)
    if (scraped) {
      jobData = { ...jobData, ...scraped }
    }
  }

  const job = await prisma.job.create({
    data: {
      userId,
      ...jobData,
    },
  })

  // Auto-score if we have resume
  const resume = await prisma.resume.findFirst({
    where: { userId, isActive: true },
  })

  if (resume && job.description) {
    try {
      const scoreResult = await scoreJob(job.description, resume.content)
      await prisma.job.update({
        where: { id: job.id },
        data: {
          score: scoreResult.score,
          scoreReason: scoreResult.reason,
          status: scoreResult.score >= 7 ? 'HIGH_MATCH' : 'SCORED',
        },
      })
    } catch (error) {
      console.error('Scoring error:', error)
    }
  }

  return NextResponse.json(job)
}
