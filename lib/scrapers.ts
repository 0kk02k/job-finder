// AI-powered job scrapers for major platforms
// Uses AI for extraction from unstructured pages and semantic matching

import { chromium } from 'playwright'
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

// ponytail: simple URL scraper for single job posting
export async function scrapeJobUrl(url: string): Promise<Partial<ScrapedJob> | null> {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    const html = await page.content()
    const extracted = await extractJobFromHTML(html, url, 'ollama')

    return extracted
  } catch (error) {
    console.error('Scrape error:', error)
    return null
  } finally {
    await browser.close()
  }
}

// Indeed search with AI fallback
export async function searchIndeed(params: {
  query: string
  location?: string
  remote?: boolean
  useAI?: boolean
}): Promise<ScrapedJob[]> {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const jobs: ScrapedJob[] = []

  try {
    const baseUrl = 'https://de.indeed.com/jobs'
    const searchParams = new URLSearchParams({
      q: params.query,
      l: params.location || '',
      vjk: 'extended',
    })

    await page.goto(`${baseUrl}?${searchParams.toString()}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('.job_seen_beacon, [class*="jobCard"]', { timeout: 15000 })

    const jobCards = await page.$$('.job_seen_beacon, [class*="jobCard"]')

    for (const card of jobCards.slice(0, 25)) {
      try {
        const titleEl = await card.$('h2, [class*="jobTitle"]')
        const title = titleEl ? await titleEl.textContent() : ''

        const companyEl = await card.$('[data-testid="company-name"]')
        const company = companyEl ? await companyEl.textContent() : ''

        const locationEl = await card.$('[data-testid="job-location"]')
        const location = locationEl ? await locationEl.textContent() : ''

        const linkEl = await card.$('a, h2 a')
        const link = linkEl ? await linkEl.getAttribute('href') : ''

        const salaryEl = await card.$('[data-testid="job-salary"]')
        const salary = salaryEl ? await salaryEl.textContent() : ''

        if (title && link) {
          const fullUrl = link.startsWith('http') ? link : `https://de.indeed.com${link}`

          jobs.push({
            title: title.trim(),
            company: company?.trim() || '',
            location: location?.trim() || '',
            description: '',
            url: fullUrl,
            salary: salary?.trim() || undefined,
            platform: 'indeed',
          })
        }
      } catch (e) {
        continue
      }
    }
  } catch (error) {
    console.error('Indeed scraper error:', error)
  } finally {
    await browser.close()
  }

  return jobs
}

// LinkedIn search (limited without login)
export async function searchLinkedIn(params: {
  query: string
  location?: string
  remote?: boolean
}): Promise<ScrapedJob[]> {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const jobs: ScrapedJob[] = []

  try {
    const baseUrl = 'https://www.linkedin.com/jobs/search'
    const searchParams = new URLSearchParams({
      keywords: params.query,
      location: params.location || '',
    })

    await page.goto(`${baseUrl}?${searchParams.toString()}`, { waitUntil: 'networkidle' })

    // Try to wait for job cards with timeout
    try {
      await page.waitForSelector('.job-search-card, [class*="job-card"]', { timeout: 8000 })
    } catch {
      // LinkedIn often blocks without login, return empty
      return []
    }

    const jobCards = await page.$$('.job-search-card, [class*="job-card"]')

    for (const card of jobCards.slice(0, 10)) {
      try {
        const title = await card.$eval('h3, [class*="job-title"]', el => el.textContent?.trim() || '')
        const company = await card.$eval('[class*="company-name"]', el => el.textContent?.trim() || '')
        const location = await card.$eval('[class*="job-location"]', el => el.textContent?.trim() || '')
        const link = await card.$eval('a', el => el.getAttribute('href'))

        if (title && link) {
          jobs.push({
            title,
            company,
            location,
            description: '',
            url: link.startsWith('http') ? link : `https://www.linkedin.com${link}`,
            platform: 'linkedin',
          })
        }
      } catch (e) {
        continue
      }
    }
  } catch (error) {
    console.error('LinkedIn scraper error:', error)
  } finally {
    await browser.close()
  }

  return jobs
}

// Glassdoor search
export async function searchGlassdoor(params: {
  query: string
  location?: string
}): Promise<ScrapedJob[]> {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const jobs: ScrapedJob[] = []

  try {
    const searchSlug = params.query.toLowerCase().replace(/\s+/g, '-')
    const url = `https://www.glassdoor.de/Job/${searchSlug}-jobs-SRCH_${params.location || 'DE'}.htm`

    await page.goto(url, { waitUntil: 'networkidle' })

    try {
      await page.waitForSelector('.jobItem, [class*="job-listing"]', { timeout: 10000 })
    } catch {
      return []
    }

    const jobCards = await page.$$('.jobItem, [class*="job-listing"]')

    for (const card of jobCards.slice(0, 15)) {
      try {
        const title = await card.$eval('a, [class*="job-title"]', el => el.textContent?.trim() || '')
        const company = await card.$eval('[class*="employer-name"]', el => el.textContent?.trim() || '')
        const location = await card.$eval('[class*="job-location"]', el => el.textContent?.trim() || '')
        const link = await card.$eval('a', el => el.getAttribute('href'))

        if (title && link) {
          jobs.push({
            title,
            company,
            location,
            description: '',
            url: link.startsWith('http') ? link : `https://www.glassdoor.de${link}`,
            platform: 'glassdoor',
          })
        }
      } catch (e) {
        continue
      }
    }
  } catch (error) {
    console.error('Glassdoor scraper error:', error)
  } finally {
    await browser.close()
  }

  return jobs
}

// AI-powered job enrichment for unknown layouts
export async function enrichJobAI(job: ScrapedJob, provider: string = 'ollama'): Promise<ScrapedJob> {
  if (job.description && job.description.length > 100) return job

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    await page.goto(job.url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    const html = await page.content()

    // Use AI to extract job data from unstructured HTML
    const extracted = await extractJobFromHTML(html, job.url, provider)

    if (extracted) {
      return {
        ...job,
        title: extracted.title || job.title,
        company: extracted.company || job.company,
        location: extracted.location || job.location,
        description: extracted.description || job.description,
        salary: extracted.salary || job.salary,
        platform: job.platform,
      }
    }
  } catch (error) {
    console.error('AI enrich error:', error)
  } finally {
    await browser.close()
  }

  return job
}

// Generic job search with AI-powered semantic matching
export async function searchJobs(params: {
  query: string
  location?: string
  remote?: boolean
  platforms?: string[]
  useAI?: boolean
  resume?: string // For semantic matching
}): Promise<ScrapedJob[]> {
  const platforms = params.platforms || ['indeed', 'glassdoor'] // Skip LinkedIn by default (needs login)
  const allJobs: ScrapedJob[] = []

  // Run scrapers
  const scrapers: Promise<ScrapedJob[]>[] = []

  if (platforms.includes('indeed')) {
    scrapers.push(searchIndeed(params))
  }

  if (platforms.includes('linkedin')) {
    scrapers.push(searchLinkedIn(params))
  }

  if (platforms.includes('glassdoor')) {
    scrapers.push(searchGlassdoor(params))
  }

  const results = await Promise.allSettled(scrapers)

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allJobs.push(...result.value)
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>()
  const uniqueJobs = allJobs.filter(job => {
    if (seen.has(job.url)) return false
    seen.add(job.url)
    return true
  })

  // AI-powered enrichment if requested
  if (params.useAI) {
    const enriched = await Promise.all(
      uniqueJobs.map(async (job) => {
        try {
          return await enrichJobAI(job)
        } catch {
          return job
        }
      })
    )
    return enriched
  }

  return uniqueJobs
}

// Semantic search - finds jobs that match even with different titles
export async function semanticSearch(params: {
  resume: string
  query: string
  location?: string
  remote?: boolean
  provider?: string
}): Promise<any[]> {
  // First, get raw jobs
  const rawJobs = await searchJobs({
    query: params.query,
    location: params.location,
    remote: params.remote,
    useAI: true,
  })

  // Convert to format for semantic search
  const semanticJobs = rawJobs.map(job => ({
    ...job,
    relevanceScore: 0,
    matchReason: '',
    transferableSkills: [] as string[],
  }))

  // Use AI for semantic matching
  const result = await semanticJobSearch(
    params.resume,
    params.query,
    semanticJobs,
    params.provider || 'ollama'
  )

  return result.jobs.filter(job => job.relevanceScore >= 0.6)
}
