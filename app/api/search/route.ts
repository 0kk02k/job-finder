import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { searchJobs, semanticSearch, type ScrapedJob } from '@/lib/scrapers'
import { scoreJob, generateSearchQueries } from '@/lib/ai'

// POST /api/search - AI-powered job search with semantic matching
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const body = await request.json()
  const { query, location, remote, platforms, useAI, semantic } = body

  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 })
  }

  // Get active resume (optional — AI scoring requires it, search works without)
  const resume = await prisma.resume.findFirst({
    where: { userId, isActive: true },
  })

  let jobs: any[] = []

  // Semantic search - AI-powered matching (requires resume)
  if (semantic && resume) {
    try {
      jobs = await semanticSearch({
        resume: resume.content,
        query,
        location,
        remote,
      })

      // Save high matches
      const highMatches = jobs.filter(job => job.relevanceScore >= 0.7)

      for (const job of highMatches) {
        try {
          await prisma.job.upsert({
            where: { url: job.url },
            update: {
              score: Math.round(job.relevanceScore * 10),
              scoreReason: job.matchReason,
              status: 'HIGH_MATCH',
            },
            create: {
              userId,
              title: job.title,
              company: job.company,
              location: job.location,
              description: job.description,
              url: job.url,
              score: Math.round(job.relevanceScore * 10),
              scoreReason: job.matchReason,
              status: 'HIGH_MATCH',
            },
          })
        } catch (e) {
          continue
        }
      }

      return NextResponse.json({
        total: jobs.length,
        highMatches: jobs.filter(j => j.relevanceScore >= 0.7).length,
        jobs,
        semantic: true,
      })
    } catch (error) {
      console.error('Semantic search error:', error)
      // Fall back to traditional search
    }
  }

  // Traditional search with AI enrichment
  const rawJobs = await searchJobs({ query, location, remote, platforms, useAI: true })

  // Score jobs with AI (requires resume)
  const resumeContent = resume?.content
  const scoredJobs = await Promise.all(
    rawJobs.map(async (job) => {
      if (!resumeContent) return job
      try {
        if (job.description) {
          const scoreResult = await scoreJob(job.description, resumeContent)
          return {
            ...job,
            aiScore: scoreResult.score,
            aiReason: scoreResult.reason,
            gaps: scoreResult.gaps,
            strengths: scoreResult.strengths,
          }
        }
        return job
      } catch {
        return job
      }
    })
  )

  // Save high matches
  type ScoredJob = ScrapedJob & {
    aiScore: number
    aiReason: string
    gaps: string[]
    strengths: string[]
  }
  const highMatches = scoredJobs.filter(
    (job): job is ScoredJob => 'aiScore' in job && job.aiScore >= 7
  )

  for (const job of highMatches) {
    try {
      await prisma.job.upsert({
        where: { url: job.url },
        update: {
          score: job.aiScore,
          scoreReason: job.aiReason,
          status: 'HIGH_MATCH',
        },
        create: {
          userId,
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.description,
          url: job.url,
          score: job.aiScore,
          scoreReason: job.aiReason,
          status: 'HIGH_MATCH',
        },
      })
    } catch (e) {
      continue
    }
  }

  return NextResponse.json({
    total: scoredJobs.length,
    highMatches: highMatches.length,
    jobs: scoredJobs,
    semantic: false,
  })
}

// GET /api/search - get alternative search queries via AI
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id
  const query = searchParams.get('query')

  if (!query) {
    return NextResponse.json({ queries: [] })
  }

  // Get resume for AI
  const resume = await prisma.resume.findFirst({
    where: { userId, isActive: true },
  })

  if (!resume) {
    return NextResponse.json({ queries: [] })
  }

  // Generate alternative queries
  const queries = await generateSearchQueries(resume.content, query)

  return NextResponse.json({ queries })
}
