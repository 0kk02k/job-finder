'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button, ScoreBadge, InfoChip } from '../components/ui'
import { HIGH_MATCH_THRESHOLD } from '@/lib/matching'
import { platformLabel } from '@/lib/sources'
import { mergeStreamedJobs, SCORE_LIMIT } from '@/lib/search'
import { textSnippet } from '../components/Markdown'
import { useToast } from '../components/Toast'

interface SearchResult {
  title: string
  company: string
  location: string
  description: string
  url: string
  platform: string
  aiScore?: number
  aiReason?: string
  strengths?: string[]
  gaps?: string[]
  relevanceScore?: number
  matchReason?: string
  transferableSkills?: string[]
}

interface SavedSearch {
  id: string
  query: string
  location: string | null
  remote: boolean
  semantic: boolean
  lastRunAt: string | null
  lastNewJobs: number | null
}

// Stream-Zeilen des Such-Endpoints: Progress unterwegs, am Ende genau ein
// „result“ (mit der gewohnten Payload) oder „error“
type StreamEvent =
  | { type: 'progress'; stage: 'source'; platform: string; found: number }
  | { type: 'progress'; stage: 'ba-details'; done: number; total: number }
  | { type: 'progress'; stage: 'sources-done'; total: number }
  | { type: 'progress'; stage: 'ai-matching'; total: number }
  | { type: 'progress'; stage: 'query-fan'; queries: string[] }
  | { type: 'progress'; stage: 'second-round'; terms: string[] }
  // Live-Strom: ein Ranking-Chunk ist fertig — die Karten erscheinen sofort
  | { type: 'jobs'; jobs: SearchResult[] }
  | {
      type: 'result'
      total: number
      highMatches: number
      newJobs?: number
      jobs: SearchResult[]
      ids: Record<string, string>
      semantic?: boolean
      // true: das Ranking ist komplett ausgefallen — jobs ist der ungerankete
      // Pool (nur Anzeige, nichts in der Liste)
      rankingFailed?: boolean
    }
  | { type: 'error'; message: string }

// Fortschritt für das Stufen-Panel: jede Quelle meldet sich einzeln, die BA
// zählt ihre Details, die KI meldet ihren Start — das Panel erzählt die
// Quellentransparenz statt einer generischen Statuszeile
interface StageState {
  sources: { platform: string; found: number }[]
  sourcesDone: boolean
  totalFound: number | null
  ba: { done: number; total: number } | null
  ai: boolean
  fan: string[] | null
  secondRound: string[] | null
}
const EMPTY_STAGES: StageState = {
  sources: [],
  sourcesDone: false,
  totalFound: null,
  ba: null,
  ai: false,
  fan: null,
  secondRound: null,
}

function SearchPageContent() {
  const searchParams = useSearchParams()
  const savedId = searchParams.get('saved')
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [remote, setRemote] = useState(false)
  const [semantic, setSemantic] = useState(true)
  // Kontrolle statt Stillstand: Übernahme in die Liste ist sichtbar und abschaltbar —
  // nicht mehr ein Nebeneffekt, über den die Fläche schweigt
  const [autoSave, setAutoSave] = useState(true)
  const [loading, setLoading] = useState(false)
  const [stages, setStages] = useState<StageState>(EMPTY_STAGES)
  // Ehrlicher Zeitvertrag: verstrichene Sekunden während des Laufs
  const [elapsed, setElapsed] = useState(0)
  // Resume-Status: true/false/null (null = unbekannt, dann kein Behaupten)
  const [hasResume, setHasResume] = useState<boolean | null>(null)
  // Phasen-Ansagen für Screenreader — Statuswechsel, nicht jeder Chunk
  const [announce, setAnnounce] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const resultsHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const [results, setResults] = useState<SearchResult[]>([])
  // url → Job-ID: macht den (ggf. soeben erzeugten) Listeneintrag auffindbar
  const [jobIds, setJobIds] = useState<Record<string, string>>({})
  const [stats, setStats] = useState({ total: 0, highMatches: 0, newJobs: 0 })
  // Für die ehrliche Limit-Zeile: wie viele der Treffer tatsächlich einen Score haben
  const scoredCount = results.filter((j) => typeof j.aiScore === 'number').length
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [justSaved, setJustSaved] = useState(false)
  // Läuft gerade eine manuelle Übernahme (url der Karte) — Button gesperrt
  const [savingJobUrl, setSavingJobUrl] = useState<string | null>(null)

  const autoRanRef = useRef(false)

  useEffect(() => {
    fetchSavedSearches()
  }, [])

  // Resume-Status beim Mount klären — ohne Lebenslauf fällt die KI-Bewertung
  // aus, und das sagen wir vorher, statt eine „Kein Score“-Wand zu zeigen
  useEffect(() => {
    fetch('/api/resume')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setHasResume(Boolean(data && data.id)))
      .catch(() => setHasResume(null))
  }, [])

  // Verstrichene Sekunden — die Fläche zeigt, dass sie lebt, und wie lange
  useEffect(() => {
    if (!loading) return
    const startedAt = Date.now()
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [loading])

  // Auto-run a saved search when arriving via ?saved=<id>
  useEffect(() => {
    if (!savedId || autoRanRef.current || savedSearches.length === 0) return
    const saved = savedSearches.find((s) => s.id === savedId)
    if (!saved) return
    autoRanRef.current = true
    // Populate form from saved search params — one-time sync on page load
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(saved.query)
    setLocation(saved.location || '')
    setRemote(saved.remote)
    setSemantic(saved.semantic)
    runSearch(saved.query, saved.location || '', saved.remote, saved.semantic, saved.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedId, savedSearches])

  // Ein Ladefehler bleibt ein Fehler: schlanke Meldung mit Retry, nicht eine
  // leere Sektion (Muster: Dashboard)
  const [savedSearchesError, setSavedSearchesError] = useState(false)

  async function fetchSavedSearches() {
    try {
      const res = await fetch('/api/searches')
      if (res.ok) {
        setSavedSearches(await res.json())
        setSavedSearchesError(false)
      } else {
        setSavedSearchesError(true)
      }
    } catch {
      setSavedSearchesError(true)
    }
  }

  async function runSearch(
    q: string,
    loc: string,
    rem: boolean,
    sem: boolean,
    savedSearchId?: string
  ) {
    const controller = new AbortController()
    abortRef.current = controller
    // Snapshot für „Abbrechen“ — der Lauf kehrt zum Zustand davor zurück,
    // statt eine Fehlermeldung zu erfinden
    const previous = { results, jobIds, stats, searched }

    setLoading(true)
    setResults([])
    setJobIds({})
    setError(null)
    setJustSaved(false)
    setStages(EMPTY_STAGES)
    setElapsed(0)
    setAnnounce('Suche gestartet — Quellen werden durchsucht')

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, location: loc, remote: rem, semantic: sem, autoSave }),
        signal: controller.signal,
      })

      // Fehler vor dem Stream (401/400) kommen als normale JSON-Antwort
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null)
        setError(data?.error || 'Suche fehlgeschlagen')
        setResults([])
        setAnnounce('')
        return
      }

      // NDJSON zeilenweise lesen — jede Progress-Zeile aktualisiert das Panel,
      // die result-Zeile wird exakt wie früher die JSON-Antwort behandelt
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let settled = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.trim()) continue
          let event: StreamEvent
          try {
            event = JSON.parse(line)
          } catch {
            continue
          }
          if (event.type === 'progress') {
            if (event.stage === 'source') {
              // Jede Quelle ihre eigene Zeile — Quellentransparenz ist das
              // Produkt, nicht Deko
              setStages((prev) => ({
                ...prev,
                sources: prev.sources.some((s) => s.platform === event.platform)
                  ? prev.sources
                  : [...prev.sources, { platform: event.platform, found: event.found }],
              }))
            } else if (event.stage === 'ba-details') {
              setStages((prev) => ({ ...prev, ba: { done: event.done, total: event.total } }))
            } else if (event.stage === 'sources-done') {
              setStages((prev) => ({ ...prev, sourcesDone: true, totalFound: event.total }))
            } else if (event.stage === 'ai-matching') {
              setStages((prev) => ({ ...prev, sourcesDone: true, ai: true }))
              setAnnounce('Quellen durchsucht — die KI bewertet jetzt die Treffer')
            } else if (event.stage === 'query-fan') {
              setStages((prev) => ({ ...prev, fan: event.queries }))
            } else if (event.stage === 'second-round') {
              setStages((prev) => ({ ...prev, secondRound: event.terms }))
            }
          } else if (event.type === 'jobs') {
            // Live-Strom: fertige Ranking-Chunks hängen ihre Treffer sofort an
            setResults((prev) => mergeStreamedJobs(prev, event.jobs))
          } else if (event.type === 'result') {
            settled = true
            setResults(event.jobs || [])
            setJobIds(event.ids || {})
            setStats({
              total: event.total,
              highMatches: event.highMatches,
              newJobs: event.newJobs || 0,
            })
            setSearched(true)
            setAnnounce(
              event.rankingFailed
                ? `Suche abgeschlossen: ${event.total} Treffer, KI-Bewertung ausgefallen`
                : `Suche abgeschlossen: ${event.total} Treffer, ${event.highMatches} Top Matches`
            )
            // Abschlussmoment: der Sprung zur Liste — nicht lautlos unmounten
            requestAnimationFrame(() => resultsHeadingRef.current?.focus())

            // Update lastRunAt + „N neu"-Zähler if this was a saved search
            if (savedSearchId) {
              fetch(`/api/searches/${savedSearchId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lastNewJobs: event.newJobs || 0 }),
              }).catch(() => {})
              fetchSavedSearches()
            }
          } else if (event.type === 'error') {
            settled = true
            setError(event.message || 'Suche fehlgeschlagen')
            setResults([])
            setAnnounce('')
          }
        }
      }

      // Stream endete ohne Ergebnis — abgebrochen oder unvollständig
      if (!settled) {
        setError('Suche fehlgeschlagen — bitte später erneut versuchen.')
        setResults([])
      }
    } catch {
      if (controller.signal.aborted) {
        // Abbruch ist kein Fehler: Zustand von vor dem Lauf zurückholen
        setResults(previous.results)
        setJobIds(previous.jobIds)
        setStats(previous.stats)
        setSearched(previous.searched)
        setAnnounce('Suche abgebrochen')
      } else {
        setError('Suche fehlgeschlagen — bitte später erneut versuchen.')
        setResults([])
        setAnnounce('')
      }
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    // Während des Laufs ist derselbe Button der Ausstieg — kein Refresh nötig
    if (loading) {
      abortRef.current?.abort()
      return
    }
    await runSearch(query, location, remote, semantic)
  }

  async function saveCurrentSearch() {
    try {
      const res = await fetch('/api/searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, location, remote, semantic }),
      })
      if (res.ok) {
        setJustSaved(true)
        fetchSavedSearches()
      } else {
        toast.error('Suche konnte nicht gespeichert werden.')
      }
    } catch {
      toast.error('Netzwerkfehler — Suche konnte nicht gespeichert werden.')
    }
  }

  function loadSavedSearch(saved: SavedSearch) {
    setQuery(saved.query)
    setLocation(saved.location || '')
    setRemote(saved.remote)
    setSemantic(saved.semantic)
    runSearch(saved.query, saved.location || '', saved.remote, saved.semantic, saved.id)
  }

  // Leere-Suche-Hebel: dieselbe Suche mit einer gezielten Lockerung erneut
  // laufen lassen — der Nutzer entscheidet mit einem Klick, nicht durch Tippen
  async function rerunWith(partial: { location?: string; remote?: boolean; semantic?: boolean }) {
    const nextLocation = partial.location ?? location
    const nextRemote = partial.remote ?? remote
    const nextSemantic = partial.semantic ?? semantic
    setLocation(nextLocation)
    setRemote(nextRemote)
    setSemantic(nextSemantic)
    await runSearch(query, nextLocation, nextRemote, nextSemantic)
  }

  async function ignoreJob(job: SearchResult) {
    try {
      const res = await fetch('/api/jobs/ignore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: job.url,
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.description,
        }),
      })
      if (res.ok) {
        setResults((prev) => prev.filter((j) => j.url !== job.url))
      } else {
        toast.error('Ignorieren fehlgeschlagen — der Treffer bleibt in der Liste.')
      }
    } catch {
      toast.error('Netzwerkfehler — der Treffer bleibt in der Liste.')
    }
  }

  // Manuelle Übernahme eines Treffers in die Liste — auch ohne Auto-Save-Haken.
  // Ein bereits berechneter Score wandert mit; der Endpunkt überspringt dann
  // sein eigenes Nach-Scoring (kein zweiter KI-Call für dasselbe Ergebnis).
  async function saveJob(job: SearchResult) {
    if (savingJobUrl) return
    setSavingJobUrl(job.url)
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: job.url,
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.description,
          aiScore: job.aiScore,
          aiReason: job.aiReason,
          strengths: job.strengths,
          gaps: job.gaps,
          transferableSkills: job.transferableSkills,
        }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.id) {
        setJobIds((prev) => ({ ...prev, [job.url]: data.id }))
      } else {
        toast.error(data?.error || 'Übernehmen fehlgeschlagen — der Treffer bleibt in der Liste.')
      }
    } catch {
      toast.error('Netzwerkfehler — der Treffer bleibt in der Liste.')
    } finally {
      setSavingJobUrl(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">

      <main className="max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <section className="mb-12">
          <h1 className="text-3xl font-light text-foreground mb-3">
            Jobsuche
          </h1>
        </section>

        {/* Saved Searches */}
        {savedSearchesError && (
          <div
            role="status"
            className="mb-6 p-3 bg-warning/10 rounded-xl border border-warning/20 flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm text-primary">Gespeicherte Suchen konnten nicht geladen werden.</p>
            <button
              onClick={() => void fetchSavedSearches()}
              className="text-sm font-medium text-primary hover:text-selection transition-colors"
            >
              Erneut versuchen
            </button>
          </div>
        )}
        {savedSearches.length > 0 && (
          <section className="mb-6">
            <p className="text-sm font-medium text-foreground mb-3">
              Gespeicherte Suchen
            </p>
            <div className="flex flex-wrap gap-2">
              {savedSearches.map((saved) => (
                <button
                  key={saved.id}
                  onClick={() => loadSavedSearch(saved)}
                  disabled={loading}
                  className="text-sm px-4 py-2 rounded-xl bg-border-soft text-foreground hover:bg-border transition-colors border border-border disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saved.query}
                  {saved.location ? ` · ${saved.location}` : ''}
                  {saved.remote ? ' · Remote' : ''}
                  {saved.lastNewJobs != null && saved.lastNewJobs > 0 && (
                    <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded-full bg-success/10 text-success border border-success/20 text-xs font-medium tabular-nums">
                      {saved.lastNewJobs} neu
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Search Form */}
        <section className="bg-surface rounded-2xl p-8 border border-border shadow-sm mb-8">
          <form onSubmit={handleSearch} className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="min-w-0 md:col-span-2">
                <label htmlFor="search-query" className="block text-sm font-medium text-foreground mb-2">
                  Beruf oder Stichwort
                </label>
                <input
                  id="search-query"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="z. B. Pflegefachkraft, Tischlerin, Lehrer, UX-Designer"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-primary-soft"
                  required
                />
              </div>

              <div className="min-w-0">
                <label htmlFor="search-location" className="block text-sm font-medium text-foreground mb-2">
                  Ort (optional)
                </label>
                <div className="flex gap-2">
                  <input
                    id="search-location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="z. B. Berlin"
                    className="min-w-0 flex-1 px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-primary-soft"
                  />
                  {/* Während des Laufs ist derselbe Button der Ausstieg — feste
                      Mindestbreite, damit das Label nicht die Fläche verschiebt */}
                  <button
                    type="submit"
                    aria-label={loading ? 'Suche abbrechen' : 'Suche starten'}
                    className="px-6 py-3 bg-accent hover:bg-accent-strong text-on-accent rounded-xl font-medium transition-colors min-w-[7.5rem] text-center"
                  >
                    {loading ? 'Abbrechen' : 'Suchen'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remote}
                  onChange={(e) => setRemote(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-selection"
                />
                <span className="text-sm text-foreground">Nur Remote</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={semantic}
                  onChange={(e) => setSemantic(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-selection"
                />
                <span className="text-sm text-foreground">KI-Suche — findet auch anders betitelte Jobs</span>
              </label>

              {/* Die Erklärung zum Haken gehört auf die Fläche, nicht ins title —
                  Hover ist kein tragfähiger Kanal (Touch, Tastatur) */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSave}
                  onChange={(e) => setAutoSave(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-selection"
                />
                <span className="text-sm text-foreground">Treffer automatisch in meine Liste übernehmen</span>
              </label>
              {!autoSave && (
                <span className="text-xs text-primary-soft">
                  Ausgeschaltet werden Treffer nur angezeigt, nicht übernommen.
                </span>
              )}
              <Link href="/so-funktionierts" className="text-xs text-primary-soft hover:text-selection transition-colors">
                Wie entscheidet die Suche?
              </Link>
            </div>
          </form>
        </section>

        {/* Resume-Hinweis: ohne Lebenslauf fällt die KI-Bewertung aus — das
            steht vorher da, nicht als „Kein Score“-Wand danach */}
        {hasResume === false && (
          <section className="mb-8 p-4 bg-surface rounded-xl border border-selection/30 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-foreground">
              Kein Lebenslauf hinterlegt — die KI kann Treffer deshalb nicht bewerten.
            </p>
            <Link
              href="/resume"
              className="text-sm font-medium text-selection hover:text-selection-strong transition-colors"
            >
              Lebenslauf hinterlegen
            </Link>
          </section>
        )}

        {/* Phasen-Ansagen für Screenreader: Statuswechsel auf Wortebene —
            die Zähler im Panel bleiben rein visuell */}
        <p className="sr-only" role="status">
          {announce}
        </p>

        {/* Error State */}
        {error && (
          <section role="alert" className="mb-8 p-4 bg-error/10 rounded-xl border border-error/20">
            <p className="text-sm text-error">{error}</p>
          </section>
        )}

        {/* Lade-Zustand: das Panel erzählt die Suche — welche Quelle was
            beigetragen hat, wo die BA gerade steht, wie lange es dauert; die
            Skeleton-Karten bleiben darunter. Zähler sind rein visuell, die
            Phasen wechseln über die sr-only-Region oben */}
        {loading && (
          <section className="space-y-4">
            <div className="bg-surface rounded-2xl p-6 border border-border space-y-2.5">
              <StageRow
                done={stages.sourcesDone}
                text={stages.sourcesDone
                  ? `Quellen durchsucht — ${stages.totalFound ?? stages.sources.reduce((n, s) => n + s.found, 0)} Treffer`
                  : 'Quellen werden durchsucht …'}
              />
              {(stages.sources.length > 0 || (stages.ba && !stages.sourcesDone)) && (
                <div className="pl-6 space-y-1.5">
                  {stages.sources.map((s) => (
                    <p key={s.platform} className="text-sm text-primary-soft">
                      {platformLabel(s.platform)} · {s.found} Treffer
                    </p>
                  ))}
                  {stages.ba && !stages.sourcesDone && (
                    <p className="text-sm text-primary-soft tabular-nums">
                      Arbeitsagentur · Details {stages.ba.done}/{stages.ba.total}
                    </p>
                  )}
                </div>
              )}
              {stages.ai && (
                <StageRow
                  done={false}
                  text="KI bewertet Treffer …"
                  meta={scoredCount > 0 ? `${elapsed} s · ${scoredCount} bewertet` : `${elapsed} s`}
                />
              )}
              {stages.fan && stages.fan.length > 0 && (
                <p className="pl-6 text-sm text-primary-soft">
                  Auch gesucht: {stages.fan.join(' · ')}
                </p>
              )}
              {stages.secondRound && stages.secondRound.length > 0 && (
                <p className="pl-6 text-sm text-primary-soft">
                  Zweitrunde: {stages.secondRound.join(' · ')}
                </p>
              )}
              <p className="text-xs text-primary-soft pt-1">Dauert meist 30–60 Sekunden.</p>
            </div>
            {results.length === 0 ? (
              [0, 1, 2].map((i) => (
                <div key={i} className="bg-surface rounded-2xl p-8 border border-border animate-pulse motion-reduce:animate-none" aria-hidden="true">
                  <div className="h-5 w-2/3 bg-border rounded mb-4" />
                  <div className="h-4 w-1/3 bg-border-soft rounded mb-6" />
                  <div className="h-4 w-full bg-border-soft rounded" />
                </div>
              ))
            ) : (
              // Live-Strom: fertige Karten stehen unter dem Panel, während die
              // KI die restlichen Chunks bewertet — die Fläche lebt sichtbar
              <div className="space-y-4">
                {results.map((job) => (
                  <JobCard
                    key={job.url}
                    job={job}
                    jobId={jobIds[job.url]}
                    onIgnore={() => ignoreJob(job)}
                    onSave={() => void saveJob(job)}
                    saving={savingJobUrl === job.url}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* New Jobs Banner */}
        {!loading && searched && stats.newJobs > 0 && (
          <section className="mb-8 p-4 bg-success/10 rounded-xl border border-success/20 flex items-center justify-between">
            <p className="text-sm text-success">
              {stats.newJobs} {stats.newJobs === 1 ? 'neuer Job' : 'neue Jobs'} zu deiner Liste hinzugefügt
            </p>
            {!justSaved && (
              <Button size="sm" onClick={saveCurrentSearch}>
                + Suche speichern
              </Button>
            )}
            {justSaved && (
              <span className="text-sm text-primary-soft">Gespeichert.</span>
            )}
          </section>
        )}

        {/* Stats */}
        {!loading && results.length > 0 && (
          <section className="grid sm:grid-cols-2 gap-4 mb-8">
            <StatCard title="Jobs gefunden" value={stats.total.toString()} />
            <StatCard
              title={`High Matches (≥${HIGH_MATCH_THRESHOLD})`}
              value={stats.highMatches.toString()}
              highlight
            />
            {/* Das Scoring-Limit ehrlich benennen: ohne diese Zeile sieht
                „ohne Score" nach einem kaputten System aus, nicht nach einem Limit */}
            {scoredCount > 0 && scoredCount < results.length && (
              <p className="sm:col-span-2 text-sm text-primary tabular-nums">
                KI-Bewertung: {scoredCount} von {results.length} Treffern bewertet — bewertet
                werden die ersten {SCORE_LIMIT} Treffer pro Suche, der Rest bleibt ohne Score.{' '}
                <Link href="/so-funktionierts" className="text-selection hover:text-selection-strong">
                  Warum?
                </Link>
              </p>
            )}
            {/* Die „Kein Score"-Wand (0 bewertet): erklären, statt schweigen —
                ohne Resume redet der Hinweis oben, hier bleibt der KI-Ausfall */}
            {scoredCount === 0 && hasResume !== false && (
              <p className="sm:col-span-2 text-sm text-primary">
                Kein Treffer wurde bewertet — die KI war in diesem Lauf nicht
                erreichbar. Der nächste Suchlauf versucht es erneut; einzelne
                Treffer kannst du in deiner Liste öffnen und „Jetzt bewerten“.{' '}
                <Link href="/so-funktionierts" className="text-selection hover:text-selection-strong">
                  So funktioniert’s
                </Link>
              </p>
            )}
            {/* Der Speicher-Hebel gehört zum Lauf, nicht nur zu neuen Funden —
                eine erfolgreiche Suche ohne Neueinträge ist genauso wiederholbar.
                Die eine Handlungs-Fläche am Ende eines Laufs: Ocker wie der
                Suchen-Button, der Textlink ersetzt */}
            {!justSaved && stats.newJobs === 0 && (
              <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                <Button size="sm" onClick={saveCurrentSearch}>
                  + Suche speichern
                </Button>
                <span className="text-sm text-primary-soft">— später mit einem Klick wiederholen</span>
              </div>
            )}
          </section>
        )}

        {/* Results — die Überschrift ist der Fokus-Anker nach Abschluss:
            Tastatur und Screenreader landen hier, nicht im Leeren */}
        {!loading && results.length > 0 && (
          <section className="space-y-4">
            <h2
              ref={resultsHeadingRef}
              tabIndex={-1}
              className="text-lg font-light text-foreground focus:outline-none"
            >
              Treffer
            </h2>
            {results.map((job) => (
              <JobCard
                key={job.url}
                job={job}
                jobId={jobIds[job.url]}
                onIgnore={() => ignoreJob(job)}
                onSave={() => void saveJob(job)}
                saving={savingJobUrl === job.url}
              />
            ))}
          </section>
        )}

        {/* No Results State — konkrete Hebel statt eines Ratens: jeder Knopf
            lockert genau eine Einschränkung und startet dieselbe Suche neu */}
        {!loading && !error && searched && results.length === 0 && (
          <section className="bg-surface rounded-2xl p-16 text-center border border-border">
            <p className="text-primary-soft mb-6">
              Keine Jobs gefunden — mit einer Lockerung neu versuchen:
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {location && (
                <button
                  onClick={() => void rerunWith({ location: '' })}
                  className="px-5 py-2.5 bg-border-soft hover:bg-border text-foreground rounded-xl text-sm font-medium transition-colors"
                >
                  Ort „{location}“ weglassen
                </button>
              )}
              {remote && (
                <button
                  onClick={() => void rerunWith({ remote: false })}
                  className="px-5 py-2.5 bg-border-soft hover:bg-border text-foreground rounded-xl text-sm font-medium transition-colors"
                >
                  Auch vor Ort suchen
                </button>
              )}
              {!semantic && (
                <button
                  onClick={() => void rerunWith({ semantic: true })}
                  className="px-5 py-2.5 bg-border-soft hover:bg-border text-foreground rounded-xl text-sm font-medium transition-colors"
                >
                  KI-Suche einschalten
                </button>
              )}
              <button
                onClick={() => runSearch(query, location, remote, semantic)}
                className="px-5 py-2.5 bg-border-soft hover:bg-border text-foreground rounded-xl text-sm font-medium transition-colors"
              >
                Unverändert erneut suchen
              </button>
            </div>
            <p className="text-xs text-primary-soft mt-6">
              Die KI-Suche findet auch Jobs mit abweichenden Titeln —{' '}
              <Link href="/so-funktionierts" className="text-selection hover:text-selection-strong">
                so funktioniert’s
              </Link>
            </p>
          </section>
        )}

        {/* Empty State */}
        {!loading && results.length === 0 && query === '' && !searched && (
          <section className="bg-surface rounded-2xl p-16 text-center border border-border">
            <p className="text-primary-soft mb-2">
              Gib einen Suchbegriff ein, um Jobs zu finden.
            </p>
            <p className="text-sm text-primary-soft">
              Die KI-Suche erkennt auch Jobs mit abweichenden Titeln.
            </p>
          </section>
        )}
      </main>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageContent />
    </Suspense>
  )
}

function StatCard({ title, value, highlight }: { title: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-surface rounded-2xl p-6 border border-border-soft">
      <p className="text-sm text-primary-soft mb-1">{title}</p>
      <p className={`text-3xl font-light tabular-nums ${highlight ? 'text-success' : 'text-foreground'}`}>
        {value}
      </p>
    </div>
  )
}

// Eine Zeile im Fortschritts-Panel: Haken wenn fertig, Punkt wenn läuft —
// die Symbole sind dekorativ, der Text trägt die Information
function StageRow({ done, text, meta }: { done: boolean; text: string; meta?: string }) {
  return (
    <p className="flex items-center gap-2 text-sm">
      <span aria-hidden="true" className={done ? 'text-success' : 'text-selection'}>
        {done ? '✓' : '●'}
      </span>
      <span className={done ? 'text-success' : 'text-foreground'}>{text}</span>
      {meta && <span className="text-primary-soft tabular-nums">{meta}</span>}
    </p>
  )
}

function JobCard({
  job,
  jobId,
  onIgnore,
  onSave,
  saving,
}: {
  job: SearchResult
  jobId?: string
  onIgnore: () => void
  onSave?: () => void
  saving?: boolean
}) {
  const [confirming, setConfirming] = useState(false)
  // Details (Stärken/Lücken/Übertragbares) und lange Begründungen sind
  // einklappbar — die Karte zeigt Urteil + Begründung, der Rest wächst auf Wunsch
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [reasonOpen, setReasonOpen] = useState(false)
  // Timer-Räumung beim Unmount — sonst setzt ein toter Timeout State ab
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
  }, [])
  // Die Begründung erzählt von Passung — ihre Färbung folgt dem Urteil:
  // Grün (Erfolg) nur bei echtem High Match, sonst neutral
  const isHighMatch = typeof job.aiScore === 'number' && job.aiScore >= HIGH_MATCH_THRESHOLD
  const reasonBoxClass = isHighMatch ? 'bg-success/10 border-success/20' : 'bg-surface border-border'
  const reasonLabelClass = isHighMatch ? 'text-success' : 'text-foreground'
  // Eine Skala, ein Vokabular: semanticScore kommt als aiScore (1–10) an —
  // Prozentwerte sind hier Vergangenheit, damit klassischer und semantischer
  // Pfad dasselbe sagen. Der Score selbst rendert zentral als ScoreBadge.
  const detailCount =
    (job.strengths?.length ?? 0) + (job.gaps?.length ?? 0) + (job.transferableSkills?.length ?? 0)
  // Lange Begründungen werden auf zwei Zeilen gekappt — die Karte bleibt eine
  // Karte, nicht ein Aufsatz; wer lesen will, klappt auf
  const reasonText = job.matchReason || job.aiReason || ''
  const reasonLabel = job.matchReason ? 'Warum dieser Job passt:' : 'KI-Einschätzung:'
  const reasonClamped = !reasonOpen && reasonText.length > 180

  function handleIgnoreClick() {
    if (!confirming) {
      setConfirming(true)
      // Zwei-Klick-Bestätigung mit Rückfalleitung — kein versehentliches Ignorieren,
      // kein Modal
      confirmTimer.current = setTimeout(() => setConfirming(false), 4000)
      return
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
    setConfirming(false)
    onIgnore()
  }

  return (
    <div className="bg-surface rounded-2xl p-8 border border-border shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0 flex-1">
          {/* Der Titel ist die Botschaft — Badges (Meta) kommen nach unten,
              Score vor Quelle: das Urteil zählt mehr als die Herkunft */}
          <h3 className="text-xl font-medium text-foreground mb-1">
            {job.title}
          </h3>
          <p className="text-primary-soft mb-3">
            {[
              job.company || null,
              job.location || null,
            ]
              .filter(Boolean)
              .join(' · ') || 'Ohne Angabe'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-medium border border-border bg-border-soft tabular-nums">
              {typeof job.aiScore === 'number' ? (
                <ScoreBadge score={job.aiScore} size="sm" />
              ) : (
                'Kein Score'
              )}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium border border-border bg-border-soft text-foreground">
              {platformLabel(job.platform)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 flex-shrink-0">
          {jobId ? (
            <Link
              href={`/jobs/${jobId}`}
              className="px-5 py-2.5 bg-border-soft hover:bg-border text-foreground rounded-xl text-sm font-medium transition-colors"
            >
              In deiner Liste
            </Link>
          ) : (
            onSave && (
              <button
                onClick={onSave}
                disabled={saving}
                className="px-5 py-2.5 bg-border-soft hover:bg-border text-foreground rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving ? 'Wird übernommen …' : 'Zu meiner Liste'}
              </button>
            )
          )}
          {/* Ignorieren ist die Ausnahme-Handlung — Textlink statt dritter
              Button-Fläche, im Bestätigungsmoment in Ton (Ehrliches Signal) */}
          <button
            onClick={handleIgnoreClick}
            aria-label={confirming ? 'Ignorieren endgültig bestätigen' : `Job ${job.title} ignorieren`}
            className={`px-2 py-2.5 text-sm font-medium transition-colors ${
              confirming
                ? 'text-error'
                : 'text-primary-soft hover:text-error'
            }`}
          >
            {confirming ? 'Sicher? Erneut klicken' : 'Ignorieren'}
          </button>
          {/* „Ansehen" führt raus ins Portal — ein Weg, kein CTA: Textlink wie
              auf /jobs, damit „Zu meiner Liste" die einzige Button-Fläche bleibt */}
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 py-2.5 text-sm text-primary hover:text-selection transition-colors"
          >
            Job ansehen →
          </a>
        </div>
      </div>

      {reasonText && (
        <div className={`mb-4 p-4 rounded-xl border ${reasonBoxClass}`}>
          <p className={`text-sm font-medium mb-1 ${reasonLabelClass}`}>{reasonLabel}</p>
          <p className={`text-sm text-foreground ${reasonClamped ? 'line-clamp-2' : ''}`}>
            {reasonText}
          </p>
          {reasonText.length > 180 && (
            <button
              onClick={() => setReasonOpen((prev) => !prev)}
              aria-expanded={reasonOpen}
              className="mt-1 text-xs font-medium text-selection hover:text-selection-strong transition-colors"
            >
              {reasonOpen ? 'Weniger anzeigen' : 'Mehr anzeigen'}
            </button>
          )}
        </div>
      )}

      {/* Stärken, Lücken und übertragbare Stärken wachsen auf Knopfdruck —
          geschlossen tragen sie nichts zur Kartenlänge bei */}
      {detailCount > 0 && (
        <button
          onClick={() => setDetailsOpen((prev) => !prev)}
          aria-expanded={detailsOpen}
          className="mb-4 text-sm font-medium text-selection hover:text-selection-strong transition-colors"
        >
          {detailsOpen
            ? 'Stärken & Lücken verbergen'
            : `Stärken & Lücken anzeigen (${detailCount})`}
        </button>
      )}
      {detailsOpen && (
        <>
          {job.strengths && job.strengths.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-foreground mb-2">Passt gut:</p>
              <div className="flex flex-wrap gap-2">
                {job.strengths.map((skill, i) => (
                  <InfoChip key={i} tone="success">{skill}</InfoChip>
                ))}
              </div>
            </div>
          )}

          {job.gaps && job.gaps.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-foreground mb-2">Fehlt:</p>
              <div className="flex flex-wrap gap-2">
                {job.gaps.map((gap, i) => (
                  <InfoChip key={i} tone="error">{gap}</InfoChip>
                ))}
              </div>
            </div>
          )}

          {job.transferableSkills && job.transferableSkills.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-foreground mb-2">Übertragbare Stärken:</p>
              <div className="flex flex-wrap gap-2">
                {job.transferableSkills.map((skill, i) => (
                  <InfoChip key={i}>{skill}</InfoChip>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <p className="text-sm text-primary-soft line-clamp-3 leading-relaxed">
        {job.description ? textSnippet(job.description) : ''}
      </p>
    </div>
  )
}
