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
    return NextResponse.json({ error: 'Suchbegriff erforderlich' }, { status: 400 })
  }

  // Get active resume (optional — AI scoring requires it, search works without)
  const resume = await prisma.resume.findFirst({
    where: { userId, isActive: true },
  })

  // Get user settings for Apify token + AI provider config
  const settings = await prisma.userSettings.findUnique({ where: { userId } })
  const apifyToken = settings?.apifyApiKey || null

  // AI config from user settings (falls back to Mistral via env key)
  const aiProvider = settings?.aiProvider || 'mistral'
  const aiModel = settings?.aiModel || undefined
  const aiApiKey =
    aiProvider === 'gemini'
      ? settings?.geminiApiKey || undefined
      : aiProvider === 'openai' || aiProvider === 'openrouter'
        ? settings?.openaiApiKey || undefined
        : undefined
  const aiBaseUrl = aiProvider === 'ollama' ? settings?.ollamaUrl || undefined : undefined

  type SemanticJobResult = ScrapedJob & {
    relevanceScore: number
    matchReason: string
    transferableSkills?: string[]
  }
  type ScoredJob = ScrapedJob & {
    aiScore?: number
    aiReason?: string
    gaps?: string[]
    strengths?: string[]
  }

  let jobs: SemanticJobResult[] = []

  // Semantic search - AI-powered matching (requires resume)
  if (semantic && resume && useAI !== false) {
    try {
      jobs = await semanticSearch({
        resume: resume.content,
        query,
        location,
        remote,
        provider: aiProvider,
        model: aiModel,
        apiKey: aiApiKey,
        baseUrl: aiBaseUrl,
        apifyToken,
      })

      // Save high matches
      const highMatches = jobs.filter(job => job.relevanceScore >= 0.7)

      for (const job of highMatches) {
        try {
          await prisma.job.upsert({
            where: { userId_url: { userId, url: job.url } },
            update: {
              // Never touch status here — a re-search must not reset APPLIED etc.
              score: Math.round(job.relevanceScore * 10),
              scoreReason: job.matchReason,
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
        } catch {
          continue
        }
      }

      // Empty AI result (e.g. provider unreachable) → fall through to traditional search
      if (jobs.length > 0) {
        return NextResponse.json({
          total: jobs.length,
          highMatches: jobs.filter(j => j.relevanceScore >= 0.7).length,
          jobs,
          semantic: true,
        })
      }
    } catch (error) {
      console.error('Semantic search error:', error)
      // Fall back to traditional search
    }
  }

  // Traditional search with AI enrichment
  const rawJobs = await searchJobs({
    query,
    location,
    remote,
    platforms,
    useAI: true,
    apifyToken,
  })

  // Score jobs with AI (requires resume). Capped to bound LLM costs/latency —
  // roughly one LLM call per scored job.
  const SCORE_LIMIT = 15
  const resumeContent = useAI !== false ? resume?.content : undefined
  const scoredJobs: ScoredJob[] = await Promise.all(
    rawJobs.map(async (job, index): Promise<ScoredJob> => {
      if (!resumeContent || index >= SCORE_LIMIT) return job
      try {
        if (job.description) {
          const scoreResult = await scoreJob(job.description, resumeContent, aiProvider, aiModel, aiApiKey, aiBaseUrl)
          if (scoreResult.score === null) return job // AI unreachable — leave unscored
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

  // Auto-save all results to job list
  for (const job of scoredJobs) {
    try {
      const hasScore = job.aiScore !== undefined
      const score = hasScore ? job.aiScore : null
      const scoreReason = hasScore ? job.aiReason : null
      const status = hasScore ? (score! >= 7 ? 'HIGH_MATCH' : 'SCORED') : 'DISCOVERED'

      await prisma.job.upsert({
        where: { userId_url: { userId, url: job.url } },
        update: {
          // Only refresh the score — never overwrite the user's status
          ...(score !== null && { score, scoreReason }),
        },
        create: {
          userId,
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.description,
          url: job.url,
          ...(score !== null && { score, scoreReason, status }),
        },
      })
    } catch {
      continue
    }
  }

  const highMatchCount = scoredJobs.filter(j => (j.aiScore ?? 0) >= 7).length

  return NextResponse.json({
    total: scoredJobs.length,
    highMatches: highMatchCount,
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
