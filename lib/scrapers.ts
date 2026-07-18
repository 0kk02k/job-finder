// Job search via multiple APIs + AI-powered single-URL extraction

import { extractJobFromHTML, semanticJobSearch } from './ai'

export interface ScrapedJob {
  title: string
  company: string
  location: string
  description: string
  url: string
  postedAt?: Date
  salary?: string
  platform: string
}

// Scrape a single job posting URL using fetch + AI extraction (no browser needed)
export async function scrapeJobUrl(url: string): Promise<Partial<ScrapedJob> | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    const html = await response.text()
    const extracted = await extractJobFromHTML(html, url, 'mistral')
    return extracted
  } catch (error) {
    console.error('Scrape error:', error)
    return null
  }
}

// --- Source: Jooble ---
async function searchJooble(query: string, location?: string): Promise<ScrapedJob[]> {
  const apiKey = process.env.JOOBLE_API_KEY
  if (!apiKey) return []

  try {
    const response = await fetch(`https://jooble.org/api/${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: query, location: location || '', page: '1' }),
    })
    const data = await response.json()

    return (data.jobs || []).map((job: any): ScrapedJob => ({
      title: job.title || '',
      company: job.company || '',
      location: job.location || '',
      description: (job.snippet || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim(),
      url: job.link || '',
      postedAt: job.updated ? new Date(job.updated) : undefined,
      salary: job.salary || undefined,
      platform: job.source || 'jooble',
    }))
  } catch {
    return []
  }
}

// --- Source: Remotive (remote jobs, no API key) ---
async function searchRemotive(query: string): Promise<ScrapedJob[]> {
  try {
    const response = await fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=25`)
    const data = await response.json()

    return (data.jobs || []).map((job: any): ScrapedJob => ({
      title: job.title || '',
      company: job.company_name || '',
      location: job.candidate_required_location || 'Remote',
      description: (job.description || '').replace(/<[^>]+>/g, '').trim().substring(0, 2000),
      url: job.url || '',
      postedAt: job.publication_date ? new Date(job.publication_date) : undefined,
      salary: job.salary || undefined,
      platform: 'remotive',
    }))
  } catch {
    return []
  }
}

// --- Source: Arbeitnow (EU jobs, no API key) ---
async function searchArbeitnow(query: string): Promise<ScrapedJob[]> {
  try {
    const response = await fetch('https://www.arbeitnow.com/api/job-board-api')
    const data = await response.json()

    const keywords = query.toLowerCase().split(/\s+/).filter(Boolean)

    return (data.data || [])
      .filter((job: any) => {
        const haystack = `${job.title} ${job.tags?.join(' ') || ''}`.toLowerCase()
        return keywords.some(kw => haystack.includes(kw))
      })
      .slice(0, 25)
      .map((job: any): ScrapedJob => ({
        title: job.title || '',
        company: job.company_name || '',
        location: job.location || '',
        description: (job.description || '').replace(/<[^>]+>/g, '').trim().substring(0, 2000),
        url: job.url || '',
        postedAt: job.created_at ? new Date(job.created_at * 1000) : undefined,
        salary: undefined,
        platform: 'arbeitnow',
      }))
  } catch {
    return []
  }
}

// Aggregated search across all sources
export async function searchJobs(params: {
  query: string
  location?: string
  remote?: boolean
  platforms?: string[]
  useAI?: boolean
  resume?: string
  apifyToken?: string | null
}): Promise<ScrapedJob[]> {
  const { searchLinkedInJobs } = await import('./apify')

  const sources: Promise<ScrapedJob[]>[] = [
    searchJooble(params.query, params.location),
    searchRemotive(params.query),
    searchArbeitnow(params.query),
  ]

  // Add LinkedIn via Apify when token is available
  if (params.apifyToken) {
    sources.push(
      searchLinkedInJobs(params.query, params.location, params.apifyToken)
        .then(jobs => jobs.map(j => ({ ...j, platform: 'linkedin' })))
    )
  }

  const results = await Promise.allSettled(sources)

  const allJobs: ScrapedJob[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') allJobs.push(...r.value)
  }

  // Deduplicate by URL
  const seen = new Set<string>()
  return allJobs.filter(job => {
    if (!job.url || seen.has(job.url)) return false
    seen.add(job.url)
    return true
  })
}

// Semantic search - finds jobs that match even with different titles
export async function semanticSearch(params: {
  resume: string
  query: string
  location?: string
  remote?: boolean
  provider?: string
  apifyToken?: string | null
}): Promise<any[]> {
  const rawJobs = await searchJobs({
    query: params.query,
    location: params.location,
    remote: params.remote,
    useAI: true,
    apifyToken: params.apifyToken,
  })

  const semanticJobs = rawJobs.map(job => ({
    ...job,
    relevanceScore: 0,
    matchReason: '',
    transferableSkills: [] as string[],
  }))

  const result = await semanticJobSearch(
    params.resume,
    params.query,
    semanticJobs,
    params.provider || 'mistral'
  )

  return result.jobs.filter(job => job.relevanceScore >= 0.6)
}
