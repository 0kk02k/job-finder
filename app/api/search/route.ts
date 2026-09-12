import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { searchJobs, semanticSearch, type ScrapedJob, type SearchProgressEvent } from '@/lib/scrapers'
import { scoreJob, generateSearchQueries, aiConfigFromSettings } from '@/lib/ai'
import { HIGH_MATCH_THRESHOLD, relevanceToScore } from '@/lib/matching'

export const maxDuration = 60

// Stream-Zeilen (NDJSON): Progress unterwegs, am Ende genau ein „result“ mit
// der gewohnten Payload — oder ein „error“ (ein Stream trägt keinen Statuscode)
type StreamEvent =
  | { type: 'progress'; stage: 'source'; platform: string; found: number }
  | { type: 'progress'; stage: 'ba-details'; done: number; total: number }
  | { type: 'progress'; stage: 'sources-done'; total: number }
  | { type: 'progress'; stage: 'ai-matching'; total: number }
  | {
      type: 'result'
      total: number
      highMatches: number
      newJobs: number
      jobs: unknown[]
      ids: Record<string, string>
      semantic: boolean
    }
  | { type: 'error'; message: string }

// POST /api/search - AI-powered job search with semantic matching
// Antwortet als NDJSON-Strom: Progress-Zeilen live, die Ergebnis-Payload als
// letzte Zeile. 401/400 bleiben normale JSON-Antworten — die Fläche behandelt
// sie über response.ok, bevor sie den Stream überhaupt liest.
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const body = await request.json()
  const { query, location, remote, platforms, useAI, semantic } = body
  // Kontrolle statt Stillstand: standardmäßig wird jeder Treffer in die Liste
  // übernommen (bisheriges Verhalten), aber die Fläche kann es ausschalten —
  // und der Nutzer sieht den Schalter, statt sich zu wundern, woher die 188 Jobs kamen.
  const autoSave = body.autoSave !== false

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
  // Quellen-Keys: Nutzereingabe gewinnt, Env-Fallback (Jooble war vorher Env-only)
  const joobleKey = settings?.joobleApiKey || process.env.JOOBLE_API_KEY || null
  const adzunaAppId = settings?.adzunaAppId || process.env.ADZUNA_APP_ID || null
  const adzunaAppKey = settings?.adzunaAppKey || process.env.ADZUNA_APP_KEY || null

  // AI config from user settings (falls back to Nebius via env key)
  const { provider: aiProvider, model: aiModel, apiKey: aiApiKey, baseUrl: aiBaseUrl } =
    aiConfigFromSettings(settings)

  // Existing statuses by URL — re-searches may refresh scores but must not
  // clobber statuses the user already set (APPLIED, INTERVIEW, ...)
  const existingJobs = await prisma.job.findMany({
    where: { userId },
    select: { url: true, status: true },
  })
  const statusByUrl = new Map(existingJobs.map(j => [j.url, j.status]))

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

  // Stream und Suche teilen sich eine Warteschlange: die Suche meldet sich
  // über emit, der Generator saugt sie ab und hält zwischen Ereignissen inne.
  // Client weg (cancel) → der Generator stoppt, die laufende Suche darf
  // zu Ende laufen, ihre Ereignisse gehen ins Leere.
  const queue: StreamEvent[] = []
  let notify: (() => void) | null = null
  let finished = false

  function emit(event: StreamEvent) {
    queue.push(event)
    notify?.()
    notify = null
  }

  function buildStream(): Response {
    const encoder = new TextEncoder()

    async function* events(): AsyncGenerator<StreamEvent> {
      const runPromise = search()
      while (true) {
        while (queue.length) yield queue.shift()!
        if (finished) break
        await new Promise<void>((resolve) => { notify = resolve })
      }
      await runPromise
    }

    const iterator = events()
    return new Response(new ReadableStream({
      async pull(controller) {
        const { value, done } = await iterator.next()
        if (done) controller.close()
        else controller.enqueue(encoder.encode(JSON.stringify(value) + '\n'))
      },
      cancel() { finished = true },
    }), {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  }

  async function search() {
    const onProgress = (event: SearchProgressEvent) => emit({ type: 'progress', ...event })
    try {
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
            joobleKey,
            adzunaAppId,
            adzunaAppKey,
            onProgress,
          })

          // Ignored (archived) jobs stay out of the result pool; best matches first
          jobs = jobs.filter(j => statusByUrl.get(j.url) !== 'ARCHIVED')
          jobs.sort((a, b) => b.relevanceScore - a.relevanceScore)

          // Dieselbe Skala wie der klassische Pfad: Relevanz (0–1) → Score (1–10),
          // High Match ab HIGH_MATCH_THRESHOLD — nicht ab einer zweiten Wahrheit (0.7)
          const semanticScore = (j: SemanticJobResult) => relevanceToScore(j.relevanceScore)

          // Save matches (Vorab-Match ab 0.7 Relevanz); ohne autoSave wird nichts geschrieben
          const toSave = autoSave ? jobs.filter(job => job.relevanceScore >= 0.7) : []
          const idByUrl: Record<string, string> = {}

          // Determine which are new (not yet in the user's job list)
          const existingSemantic = await prisma.job.findMany({
            where: { userId, url: { in: toSave.map(j => j.url) } },
            select: { url: true },
          })
          const existingSemanticUrls = new Set(existingSemantic.map(j => j.url))
          let newJobsCount = 0

          for (const job of toSave) {
            const isNew = !existingSemanticUrls.has(job.url)
            if (isNew) newJobsCount++
            const score = semanticScore(job)
            try {
              const saved = await prisma.job.upsert({
                where: { userId_url: { userId, url: job.url } },
                update: {
                  score,
                  scoreReason: job.matchReason,
                  matchDetails: JSON.stringify({ transferableSkills: job.transferableSkills ?? [] }),
                  // Promote to HIGH_MATCH only from pre-pipeline states —
                  // never clobber APPLIED/INTERVIEW/etc. on a re-search
                  ...(
                    score >= HIGH_MATCH_THRESHOLD &&
                    (statusByUrl.get(job.url) === 'DISCOVERED' || statusByUrl.get(job.url) === 'SCORED')
                    && { status: 'HIGH_MATCH' as const }
                  ),
                },
                create: {
                  userId,
                  title: job.title,
                  company: job.company,
                  location: job.location,
                  description: job.description,
                  url: job.url,
                  score,
                  scoreReason: job.matchReason,
                  matchDetails: JSON.stringify({ transferableSkills: job.transferableSkills ?? [] }),
                  status: score >= HIGH_MATCH_THRESHOLD ? 'HIGH_MATCH' : 'SCORED',
                },
              })
              idByUrl[job.url] = saved.id
            } catch {
              continue
            }
          }

          // Empty AI result (e.g. provider unreachable) → fall through to traditional search
          if (jobs.length > 0) {
            emit({
              type: 'result',
              total: jobs.length,
              highMatches: jobs.filter(j => semanticScore(j) >= HIGH_MATCH_THRESHOLD).length,
              newJobs: newJobsCount,
              jobs: jobs.map(j => ({ ...j, aiScore: semanticScore(j), aiReason: j.matchReason })),
              ids: idByUrl,
              semantic: true,
            })
            return
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
        joobleKey,
        adzunaAppId,
        adzunaAppKey,
        onProgress,
      })

      // Score jobs with AI (requires resume). Capped to bound LLM costs/latency —
      // roughly one LLM call per scored job. 50 statt 15: eine Bewertung kostet
      // nur Bruchteile eines Cents (GLM-5.3-Flash, siehe scoringModel) — die
      // Suche soll ihre Treffer liefern, nicht den Rückstand füttern; Reste
      // drainiert der nächtliche Cron (/api/cron/score).
      const SCORE_LIMIT = 50
      const resumeContent = useAI !== false ? resume?.content : undefined
      if (resumeContent && rawJobs.length > 0) {
        emit({ type: 'progress', stage: 'ai-matching', total: Math.min(SCORE_LIMIT, rawJobs.length) })
      }
      const scoredJobs: ScoredJob[] = await Promise.all(
        rawJobs.map(async (job, index): Promise<ScoredJob> => {
          if (!resumeContent || index >= SCORE_LIMIT) return job
          try {
            if (job.description) {
              const scoreResult = await scoreJob(job.description, resumeContent, aiProvider, aiModel, aiApiKey, aiBaseUrl, settings?.minSalary ?? null)
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

      // Ignored (archived) jobs stay out of the result pool; best scores first,
      // unscored jobs last
      const visibleJobs = scoredJobs
        .filter(j => statusByUrl.get(j.url) !== 'ARCHIVED')
        .sort((a, b) => (b.aiScore ?? -1) - (a.aiScore ?? -1))

      // Determine which jobs are new before upserting
      const existingTraditional = await prisma.job.findMany({
        where: { userId, url: { in: visibleJobs.map(j => j.url) } },
        select: { url: true },
      })
      const existingTraditionalUrls = new Set(existingTraditional.map(j => j.url))
      let newJobsCount = 0
      const idByUrl: Record<string, string> = {}

      // Auto-save all results to job list — außer die Fläche sagt es ab (autoSave: false)
      if (autoSave) {
        for (const job of visibleJobs) {
          const isNew = !existingTraditionalUrls.has(job.url)
          if (isNew) newJobsCount++
          try {
            const hasScore = job.aiScore !== undefined
            const score = hasScore ? job.aiScore : null
            const scoreReason = hasScore ? job.aiReason : null
            const matchDetails = hasScore
              ? JSON.stringify({ strengths: job.strengths ?? [], gaps: job.gaps ?? [] })
              : null
            const status = hasScore ? (score! >= HIGH_MATCH_THRESHOLD ? 'HIGH_MATCH' : 'SCORED') : 'DISCOVERED'

            const saved = await prisma.job.upsert({
              where: { userId_url: { userId, url: job.url } },
              update: {
                // Refresh score/details; promote status only from pre-pipeline
                // states — never clobber APPLIED/INTERVIEW/etc. on a re-search
                ...(score !== null && { score, scoreReason, matchDetails }),
                ...(score !== null && (statusByUrl.get(job.url) === 'DISCOVERED' || statusByUrl.get(job.url) === 'SCORED') && { status }),
              },
              create: {
                userId,
                title: job.title,
                company: job.company,
                location: job.location,
                description: job.description,
                url: job.url,
                ...(score !== null && { score, scoreReason, matchDetails, status }),
              },
            })
            idByUrl[job.url] = saved.id
          } catch {
            continue
          }
        }
      }

      const highMatchCount = visibleJobs.filter(j => (j.aiScore ?? 0) >= HIGH_MATCH_THRESHOLD).length

      emit({
        type: 'result',
        total: visibleJobs.length,
        highMatches: highMatchCount,
        newJobs: newJobsCount,
        jobs: visibleJobs,
        ids: idByUrl,
        semantic: false,
      })
    } catch (error) {
      console.error('Search error:', error)
      emit({ type: 'error', message: 'Suche fehlgeschlagen — bitte später erneut versuchen.' })
    } finally {
      finished = true
      notify?.()
      notify = null
    }
  }

  return buildStream()
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
