// Job search via Jooble API + AI-powered single-URL extraction

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
    const extracted = await extractJobFromHTML(html, url, 'ollama')
    return extracted
  } catch (error) {
    console.error('Scrape error:', error)
    return null
  }
}

// Search jobs via Jooble API
export async function searchJobs(params: {
  query: string
  location?: string
  remote?: boolean
  platforms?: string[]
  useAI?: boolean
  resume?: string
}): Promise<ScrapedJob[]> {
  const apiKey = process.env.JOOBLE_API_KEY

  if (!apiKey) {
    console.error('JOOBLE_API_KEY not set')
    return []
  }

  try {
    const response = await fetch(`https://jooble.org/api/${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keywords: params.query,
        location: params.location || '',
        page: '1',
      }),
    })

    const data = await response.json()

    const jobs: ScrapedJob[] = (data.jobs || []).map((job: any) => ({
      title: job.title || '',
      company: job.company || '',
      location: job.location || '',
      description: (job.snippet || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim(),
      url: job.link || '',
      postedAt: job.updated ? new Date(job.updated) : undefined,
      salary: job.salary || undefined,
      platform: job.source || 'jooble',
    }))

    return jobs
  } catch (error) {
    console.error('Jooble search error:', error)
    return []
  }
}

// Semantic search - finds jobs that match even with different titles
export async function semanticSearch(params: {
  resume: string
  query: string
  location?: string
  remote?: boolean
  provider?: string
}): Promise<any[]> {
  const rawJobs = await searchJobs({
    query: params.query,
    location: params.location,
    remote: params.remote,
    useAI: true,
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
    params.provider || 'ollama'
  )

  return result.jobs.filter(job => job.relevanceScore >= 0.6)
}
