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

// Semantisches Suchergebnis: ScrapedJob plus KI-Bewertung (Relevanz 0–1)
export type SemanticJob = ScrapedJob & {
  relevanceScore: number
  matchReason: string
  transferableSkills: string[]
}

// Nur die Felder der API-Antworten, die wir wirklich lesen
interface RawJoobleJob {
  title?: string
  company?: string
  location?: string
  snippet?: string
  link?: string
  updated?: string
  salary?: string
  source?: string
}

interface RawRemotiveJob {
  title?: string
  company_name?: string
  candidate_required_location?: string
  description?: string
  url?: string
  publication_date?: string
  salary?: string
}

interface RawArbeitnowJob {
  title?: string
  company_name?: string
  location?: string
  description?: string
  url?: string
  created_at?: number
  tags?: string[]
}

interface BaJob {
  stellenangebotsTitel?: string
  firma?: string
  referenznummer?: string
  externeURL?: string
  datumErsteVeroeffentlichung?: string
  festgehalt?: number
  stundenlohn?: number
  homeofficemoeglich?: boolean
  stellenlokationen?: Array<{ adresse?: { ort?: string; plz?: string } }>
}

interface RawAdzunaJob {
  title?: string
  company?: { display_name?: string }
  location?: { display_name?: string }
  description?: string
  redirect_url?: string
  created?: string
  salary_min?: number
  salary_max?: number
}

// Scrape a single job posting URL using fetch + AI extraction (no browser needed)
export async function scrapeJobUrl(url: string): Promise<Partial<ScrapedJob> | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    const html = await response.text()
    const extracted = await extractJobFromHTML(html, url, 'nebius')
    return extracted
  } catch (error) {
    console.error('Scrape error:', error)
    return null
  }
}

// --- Source: Jooble ---
async function searchJooble(query: string, location?: string, apiKey?: string | null): Promise<ScrapedJob[]> {
  const key = apiKey || process.env.JOOBLE_API_KEY
  if (!key) return []

  try {
    const response = await fetch(`https://jooble.org/api/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: query, location: location || '', page: '1' }),
    })
    const data = await response.json()
    const jobs: RawJoobleJob[] = data.jobs || []

    return jobs.map((job): ScrapedJob => ({
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
    const jobs: RawRemotiveJob[] = data.jobs || []

    return jobs.map((job): ScrapedJob => ({
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

    const jobs: RawArbeitnowJob[] = data.data || []
    return jobs
      .filter((job) => {
        const haystack = `${job.title} ${job.tags?.join(' ') || ''}`.toLowerCase()
        return keywords.some(kw => haystack.includes(kw))
      })
      .slice(0, 25)
      .map((job): ScrapedJob => ({
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

// --- Source: Bundesagentur für Arbeit (größte deutsche Jobbörse, kein eigener Key nötig) ---
// Liste:  pc/v6/jobs  (Titel, Firma, Ort, Gehalt, Refnr — aber keine Beschreibung)
// Detail: pc/v4/jobdetails/{base64(Refnr)} → stellenangebotsBeschreibung als Klartext
const BA_BASE = 'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service'
const BA_HEADERS = { 'X-API-Key': process.env.ARBEITSAGENTUR_API_KEY || 'jobboerse-jobsuche' }

async function baDetail(refnr: string): Promise<string> {
  const response = await fetch(
    `${BA_BASE}/pc/v4/jobdetails/${Buffer.from(refnr).toString('base64')}`,
    { headers: BA_HEADERS }
  )
  if (!response.ok) return ''
  const data = await response.json()
  return (data.stellenangebotsBeschreibung || '').replace(/\r/g, '').trim()
}

async function searchArbeitsagentur(query: string, location?: string): Promise<ScrapedJob[]> {
  try {
    const url = new URL(`${BA_BASE}/pc/v6/jobs`)
    url.searchParams.set('was', query)
    if (location) url.searchParams.set('wo', location)
    url.searchParams.set('size', '25')
    url.searchParams.set('page', '1')

    const response = await fetch(url, { headers: BA_HEADERS })
    if (!response.ok) return []
    const data = await response.json()
    const items: BaJob[] = data.ergebnisliste || []

    // Beschreibungen nachladen — in Zehner-Chunks statt 25 parallelen Requests.
    // Fail-soft je Job: ohne Detailtext bleibt der Treffer unbezahlt unscoriert,
    // statt die ganze Quelle zu gefährden.
    const descriptions = new Map<string, string>()
    for (let i = 0; i < items.length; i += 10) {
      await Promise.all(
        items.slice(i, i + 10).map(async (job) => {
          if (!job.referenznummer) return
          try {
            descriptions.set(job.referenznummer, await baDetail(job.referenznummer))
          } catch {
            // ohne Beschreibung weiter
          }
        })
      )
    }

    return items.map((job): ScrapedJob => {
      const adresse = job.stellenlokationen?.[0]?.adresse
      let description = (descriptions.get(job.referenznummer || '') || '').substring(0, 2000)
      // Home-Office-Fakt ehrlich dazuschreiben: fließt in die KI-Bewertung ein
      // und trifft den Remote-Filter, ohne den Ort zu verfälschen
      if (job.homeofficemoeglich) {
        description = description ? `Home-Office möglich. ${description}` : 'Home-Office möglich.'
      }
      return {
        title: job.stellenangebotsTitel || '',
        company: job.firma || '',
        location: adresse?.ort ? (adresse.plz ? `${adresse.ort} (${adresse.plz})` : adresse.ort) : '',
        description,
        // Externe Treffer verlinken direkt zum Arbeitgeber; der Rest auf die
        // BA-Detailseite — die URL ist zugleich Dedup-Schlüssel
        url:
          job.externeURL ||
          `https://www.arbeitsagentur.de/jobsuche/jobdetail/${encodeURIComponent(job.referenznummer || '')}`,
        postedAt: job.datumErsteVeroeffentlichung ? new Date(job.datumErsteVeroeffentlichung) : undefined,
        salary:
          job.festgehalt
            ? `ab ${Math.round(job.festgehalt).toLocaleString('de-DE')} €/Jahr`
            : job.stundenlohn
              ? `ab ${Math.round(job.stundenlohn).toLocaleString('de-DE')} €/Std.`
              : undefined,
        platform: 'arbeitsagentur',
      }
    })
  } catch {
    return []
  }
}

// --- Source: Adzuna DE (kostenloser Key: developer.adzuna.com) ---
async function searchAdzuna(
  query: string,
  location: string | undefined,
  appId: string,
  appKey: string
): Promise<ScrapedJob[]> {
  try {
    const url = new URL('https://api.adzuna.com/v1/api/jobs/de/search/1')
    url.searchParams.set('app_id', appId)
    url.searchParams.set('app_key', appKey)
    url.searchParams.set('what', query)
    if (location) url.searchParams.set('where', location)
    url.searchParams.set('results_per_page', '25')

    const response = await fetch(url)
    if (!response.ok) return []
    const data = await response.json()
    const results: RawAdzunaJob[] = data.results || []

    return results.map((job): ScrapedJob => ({
      title: (job.title || '').replace(/<[^>]+>/g, '').trim(),
      company: job.company?.display_name || '',
      location: job.location?.display_name || '',
      description: (job.description || '').trim().substring(0, 2000),
      url: job.redirect_url || '',
      postedAt: job.created ? new Date(job.created) : undefined,
      salary:
        job.salary_min && job.salary_max
          ? `${Math.round(job.salary_min).toLocaleString('de-DE')}–${Math.round(job.salary_max).toLocaleString('de-DE')} €`
          : undefined,
      platform: 'adzuna',
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
  joobleKey?: string | null
  adzunaAppId?: string | null
  adzunaAppKey?: string | null
}): Promise<ScrapedJob[]> {
  const { searchLinkedInJobs } = await import('./apify')

  const sources: Promise<ScrapedJob[]>[] = [
    searchJooble(params.query, params.location, params.joobleKey),
    searchRemotive(params.query),
    searchArbeitnow(params.query),
    searchArbeitsagentur(params.query, params.location),
  ]

  // Adzuna nur mit vollständigem Key-Paar — App-ID allein bringt nichts
  if (params.adzunaAppId && params.adzunaAppKey) {
    sources.push(searchAdzuna(params.query, params.location, params.adzunaAppId, params.adzunaAppKey))
  }

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

  // Remote filter — Remotive is remote-only by design, others are matched on
  // location/title/description (BA-Jobs tragen „Home-Office möglich" im Text)
  const filtered = params.remote
    ? allJobs.filter(j => j.platform === 'remotive' || /remote|home[\s-]?office/i.test(`${j.location} ${j.title} ${j.description}`))
    : allJobs

  // Deduplicate by URL
  const seen = new Set<string>()
  return filtered.filter(job => {
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
  model?: string
  apiKey?: string
  baseUrl?: string
  apifyToken?: string | null
  joobleKey?: string | null
  adzunaAppId?: string | null
  adzunaAppKey?: string | null
}): Promise<SemanticJob[]> {
  const rawJobs = await searchJobs({
    query: params.query,
    location: params.location,
    remote: params.remote,
    useAI: true,
    apifyToken: params.apifyToken,
    joobleKey: params.joobleKey,
    adzunaAppId: params.adzunaAppId,
    adzunaAppKey: params.adzunaAppKey,
  })

  const semanticJobs: SemanticJob[] = rawJobs.map(job => ({
    ...job,
    relevanceScore: 0,
    matchReason: '',
    transferableSkills: [],
  }))

  const result = await semanticJobSearch(
    params.resume,
    params.query,
    semanticJobs,
    params.provider || 'nebius',
    params.model,
    params.apiKey,
    params.baseUrl
  )

  return result.jobs.filter(job => job.relevanceScore >= 0.6)
}
