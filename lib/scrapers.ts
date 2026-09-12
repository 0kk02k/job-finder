// Job search via multiple APIs + AI-powered single-URL extraction

import { extractJobFromHTML, semanticJobSearch } from './ai'
import { mergeJobsByUrl, pickFuzzyTerms } from './search'
import type { PreferenceProfile } from './preferences'

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

// Fortschritt für die Stufen-Anzeige: Quellen melden Trefferzahlen, die BA
// ihren Detail-Nachlade-Stand, die Semantik ihre Bewertungsgröße
export type SearchProgressEvent =
  | { stage: 'source'; platform: string; found: number }
  | { stage: 'ba-details'; done: number; total: number }
  | { stage: 'sources-done'; total: number }
  | { stage: 'ai-matching'; total: number }
  | { stage: 'query-fan'; queries: string[] } // Query-Fächer: fachliche Varianten neben der Original-Query
  | { stage: 'second-round'; terms: string[] } // Zweitrunde: fuzzyMatches lösen einen zweiten Fetch aus

export type SearchProgressCallback = (event: SearchProgressEvent) => void

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

async function searchArbeitsagentur(
  query: string,
  location: string | undefined,
  onProgress?: SearchProgressCallback
): Promise<ScrapedJob[]> {
  try {
    // Zwei Seiten à 50 — Breite geht vor Suchzeit (die Suche soll den ganzen
    // Arbeitsmarkt sehen, nicht nur die IT-Ecke der Partnerportale)
    const pages = await Promise.all(
      [1, 2].map(async (page) => {
        const url = new URL(`${BA_BASE}/pc/v6/jobs`)
        url.searchParams.set('was', query)
        if (location) url.searchParams.set('wo', location)
        url.searchParams.set('size', '50')
        url.searchParams.set('page', String(page))
        const response = await fetch(url, { headers: BA_HEADERS })
        if (!response.ok) return [] as BaJob[]
        const data = await response.json()
        return (data.ergebnisliste || []) as BaJob[]
      })
    )

    // Dedup per Referenznummer — Seite 2 kann Seite 1 überlappen
    const byRefnr = new Map<string, BaJob>()
    for (const job of pages.flat()) {
      if (job.referenznummer) byRefnr.set(job.referenznummer, job)
    }
    const items = [...byRefnr.values()]

    // Beschreibungen nachladen — in Zehner-Chunks statt 100 parallelen Requests.
    // Fail-soft je Job: ohne Detailtext bleibt der Treffer unbezahlt unscoriert,
    // statt die ganze Quelle zu gefährden.
    const descriptions = new Map<string, string>()
    let detailsDone = 0
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
      detailsDone = Math.min(detailsDone + 10, items.length)
      onProgress?.({ stage: 'ba-details', done: detailsDone, total: items.length })
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
  onProgress?: SearchProgressCallback
}): Promise<ScrapedJob[]> {
  const { searchLinkedInJobs } = await import('./apify')

  // Jede Quelle meldet ihre Trefferzahl, sobald sie fertig ist
  const track = (platform: string, promise: Promise<ScrapedJob[]>) =>
    promise.then(jobs => {
      params.onProgress?.({ stage: 'source', platform, found: jobs.length })
      return jobs
    })

  const sources: Promise<ScrapedJob[]>[] = [
    track('jooble', searchJooble(params.query, params.location, params.joobleKey)),
    track('remotive', searchRemotive(params.query)),
    track('arbeitnow', searchArbeitnow(params.query)),
    track('arbeitsagentur', searchArbeitsagentur(params.query, params.location, params.onProgress)),
  ]

  // Adzuna nur mit vollständigem Key-Paar — App-ID allein bringt nichts
  if (params.adzunaAppId && params.adzunaAppKey) {
    sources.push(track('adzuna', searchAdzuna(params.query, params.location, params.adzunaAppId, params.adzunaAppKey)))
  }

  // Add LinkedIn via Apify when token is available
  if (params.apifyToken) {
    sources.push(
      track('linkedin',
        searchLinkedInJobs(params.query, params.location, params.apifyToken)
          .then(jobs => jobs.map(j => ({ ...j, platform: 'linkedin' })))
      )
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
  const deduped = filtered.filter(job => {
    if (!job.url || seen.has(job.url)) return false
    seen.add(job.url)
    return true
  })

  // Alle Quellen sind durch — die Fläche kann die Stufe ehrlich abschließen,
  // auch wenn keine KI-Phase folgt (kein Resume, KI-Suche aus)
  params.onProgress?.({ stage: 'sources-done', total: deduped.length })
  return deduped
}

// Semantic search - finds jobs that match even with different titles.
// Der Pool entsteht aus mehreren Queries: die Original-Query plus die fachlichen
// Varianten aus dem Query-Fächer (lib/search.ts) — so geraten Treffer in den
// Kandidatenkreis, die unter fremden Schlagworten eingestellt wurden. Der Ranker
// kann nur auswählen, was gefetcht wurde; erfindet aber nie Jobs (nur Indizes).
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
  extraQueries?: string[]
  preferences?: PreferenceProfile | null
  onProgress?: SearchProgressCallback
}): Promise<SemanticJob[]> {
  // Original-Query mit Fortschritt, Fächer still — die Fläche zeigt eine
  // Quelle-Meldung pro Plattform, nicht vier
  const fetchPool = (query: string, withProgress: boolean) =>
    searchJobs({
      query,
      location: params.location,
      remote: params.remote,
      useAI: true,
      apifyToken: params.apifyToken,
      joobleKey: params.joobleKey,
      adzunaAppId: params.adzunaAppId,
      adzunaAppKey: params.adzunaAppKey,
      ...(withProgress && { onProgress: params.onProgress }),
    })

  const pools = await Promise.all([
    fetchPool(params.query, true),
    ...(params.extraQueries ?? []).map(q => fetchPool(q, false)),
  ])

  // Der Ranker-Prompt wächst mit jedem Kandidaten — 120 sind das ehrliche
  // Maximum für einen Durchlauf; bei Überlauf gewinnt die Reihenfolge
  // (Original-Query zuerst)
  const pool = mergeJobsByUrl(pools).slice(0, 120)

  const rankPool = async (
    jobs: ScrapedJob[]
  ): Promise<{ jobs: SemanticJob[]; fuzzyMatches: string[] }> => {
    params.onProgress?.({ stage: 'ai-matching', total: jobs.length })
    const semanticJobs: SemanticJob[] = jobs.map(job => ({
      ...job,
      relevanceScore: 0,
      matchReason: '',
      transferableSkills: [],
    }))

    // Ein einziger Prompt über ~175 Treffer würde träge und timeout-anfällig —
    // darum 60er-Chunks parallel. Der Index-Mapping-Schutz bleibt pro Chunk
    // intakt.
    const CHUNK_SIZE = 60
    const chunks: SemanticJob[][] = []
    for (let i = 0; i < semanticJobs.length; i += CHUNK_SIZE) {
      chunks.push(semanticJobs.slice(i, i + CHUNK_SIZE))
    }

    const results = await Promise.all(
      chunks.map(chunk =>
        semanticJobSearch(
          params.resume,
          params.query,
          chunk,
          params.provider || 'nebius',
          params.model,
          params.apiKey,
          params.baseUrl,
          params.preferences
        )
      )
    )

    return {
      jobs: results.flatMap(result => result.jobs).filter(job => job.relevanceScore >= 0.6),
      fuzzyMatches: results.flatMap(result => result.fuzzyMatches).filter((t): t is string => typeof t === 'string'),
    }
  }

  const first = await rankPool(pool)

  // Zweitrunde: die fuzzyMatches des Rankings benennen Begriffe, unter denen
  // ähnliche Jobs stehen könnten — einmal nachgefetcht, nur neue URLs, dieselben
  // Regeln. Verlängert die Suche um einen Fetch+Rank, nicht um eine Phase.
  const terms = pickFuzzyTerms(first.fuzzyMatches, [params.query, ...(params.extraQueries ?? [])], 2)
  let jobs = first.jobs
  if (terms.length > 0) {
    params.onProgress?.({ stage: 'second-round', terms })
    const pools2 = await Promise.all(terms.map(q => fetchPool(q, false)))
    const seen = new Set(pool.map(j => j.url))
    const pool2 = mergeJobsByUrl(pools2).filter(j => !seen.has(j.url)).slice(0, 60)
    if (pool2.length > 0) {
      const second = await rankPool(pool2)
      jobs = [...jobs, ...second.jobs.filter(e => !jobs.some(f => f.url === e.url))]
    }
  }

  return jobs
}
