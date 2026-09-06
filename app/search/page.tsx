'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { scoreTone } from '../components/ui'
import { HIGH_MATCH_THRESHOLD, scoreLabel } from '@/lib/matching'
import { platformLabel } from '@/lib/sources'
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
}

// Stream-Zeilen des Such-Endpoints: Progress unterwegs, am Ende genau ein
// „result“ (mit der gewohnten Payload) oder „error“
type StreamEvent =
  | { type: 'progress'; stage: 'source'; platform: string; found: number }
  | { type: 'progress'; stage: 'ba-details'; done: number; total: number }
  | { type: 'progress'; stage: 'ai-matching'; total: number }
  | {
      type: 'result'
      total: number
      highMatches: number
      newJobs?: number
      jobs: SearchResult[]
      ids: Record<string, string>
      semantic?: boolean
    }
  | { type: 'error'; message: string }

// Fortschritt für das Stufen-Panel: Quellen melden Treffer, die BA ihren
// Detail-Stand, die KI ihren Start
interface StageState {
  found: number
  sourcesDone: boolean
  ba: { done: number; total: number } | null
  ai: boolean
}
const EMPTY_STAGES: StageState = { found: 0, sourcesDone: false, ba: null, ai: false }

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

  const autoRanRef = useRef(false)

  useEffect(() => {
    fetchSavedSearches()
  }, [])

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

  async function fetchSavedSearches() {
    try {
      const res = await fetch('/api/searches')
      if (res.ok) {
        setSavedSearches(await res.json())
      }
    } catch {
      // silently ignore
    }
  }

  async function runSearch(
    q: string,
    loc: string,
    rem: boolean,
    sem: boolean,
    savedSearchId?: string
  ) {
    setLoading(true)
    setResults([])
    setJobIds({})
    setError(null)
    setJustSaved(false)
    setStages(EMPTY_STAGES)

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, location: loc, remote: rem, semantic: sem, autoSave }),
      })

      // Fehler vor dem Stream (401/400) kommen als normale JSON-Antwort
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null)
        setError(data?.error || 'Suche fehlgeschlagen')
        setResults([])
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
              setStages((prev) => ({ ...prev, found: prev.found + event.found }))
            } else if (event.stage === 'ba-details') {
              setStages((prev) => ({ ...prev, ba: { done: event.done, total: event.total } }))
            } else if (event.stage === 'ai-matching') {
              setStages((prev) => ({ ...prev, sourcesDone: true, ai: true }))
            }
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
          }
        }
      }

      // Stream endete ohne Ergebnis — abgebrochen oder unvollständig
      if (!settled) {
        setError('Suche fehlgeschlagen — bitte später erneut versuchen.')
        setResults([])
      }
    } catch {
      setError('Suche fehlgeschlagen — bitte später erneut versuchen.')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
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
      }
    } catch {
      // ignore
    }
  }

  function loadSavedSearch(saved: SavedSearch) {
    setQuery(saved.query)
    setLocation(saved.location || '')
    setRemote(saved.remote)
    setSemantic(saved.semantic)
    runSearch(saved.query, saved.location || '', saved.remote, saved.semantic, saved.id)
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

  return (
    <div className="min-h-screen bg-background">

      <main className="max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <section className="mb-12">
          <h1 className="text-3xl font-light text-foreground mb-3">
            Jobsuche
          </h1>
          <p className="text-lg text-primary-soft">
            KI-gestützte semantische Suche findet Jobs, die auch mit anderen Titeln passen.
          </p>
        </section>

        {/* Saved Searches */}
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
                  className="text-sm px-4 py-2 rounded-xl bg-border-soft text-foreground hover:bg-border transition-colors border border-border"
                >
                  {saved.query}
                  {saved.location ? ` · ${saved.location}` : ''}
                  {saved.remote ? ' · Remote' : ''}
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
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-3 bg-accent hover:bg-accent-strong text-on-accent rounded-xl font-medium transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Suche läuft …' : 'Suchen'}
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
                  className="w-4 h-4 rounded border-border accent-primary"
                />
                <span className="text-sm text-foreground">Nur Remote</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={semantic}
                  onChange={(e) => setSemantic(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-primary"
                />
                <span className="text-sm text-foreground">KI-Suche (semantisches Matching)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer" title="Ausgeschaltet werden Treffer nur angezeigt und nicht in deine Liste übernommen">
                <input
                  type="checkbox"
                  checked={autoSave}
                  onChange={(e) => setAutoSave(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-primary"
                />
                <span className="text-sm text-foreground">Treffer automatisch in meine Liste übernehmen</span>
              </label>
            </div>
          </form>
        </section>

        {/* Error State */}
        {error && (
          <section role="alert" className="mb-8 p-4 bg-error/10 rounded-xl border border-error/20">
            <p className="text-sm text-error">{error}</p>
          </section>
        )}

        {/* Lade-Zustand: echte Stufen statt Stillstand — der Stream meldet, wo
            die Suche gerade steht; die Skeleton-Karten bleiben darunter */}
        {loading && (
          <section className="space-y-4" aria-live="polite">
            <p className="sr-only" role="status">
              Suche läuft …
            </p>
            <div className="bg-surface rounded-2xl p-6 border border-border space-y-3">
              <StageRow
                done={stages.sourcesDone}
                text={stages.sourcesDone
                  ? `Quellen durchsucht — ${stages.found} Treffer`
                  : 'Quellen werden durchsucht …'}
              />
              {stages.ba && !stages.sourcesDone && (
                <StageRow
                  done={false}
                  text={`Arbeitsagentur: Details geladen ${stages.ba.done}/${stages.ba.total}`}
                />
              )}
              {stages.ai && <StageRow done={false} text="KI bewertet Treffer …" />}
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-surface rounded-2xl p-8 border border-border animate-pulse motion-reduce:animate-none" aria-hidden="true">
                <div className="h-5 w-2/3 bg-border rounded mb-4" />
                <div className="h-4 w-1/3 bg-border-soft rounded mb-6" />
                <div className="h-4 w-full bg-border-soft rounded" />
              </div>
            ))}
          </section>
        )}

        {/* New Jobs Banner */}
        {!loading && searched && stats.newJobs > 0 && (
          <section className="mb-8 p-4 bg-success/10 rounded-xl border border-success/20 flex items-center justify-between">
            <p className="text-sm text-success">
              {stats.newJobs} {stats.newJobs === 1 ? 'neuer Job' : 'neue Jobs'} zu deiner Liste hinzugefügt
            </p>
            {!justSaved && (
              <button
                onClick={saveCurrentSearch}
                className="text-sm font-medium text-primary hover:text-accent transition-colors"
              >
                + Suche speichern
              </button>
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
                werden die ersten 15 Treffer pro Suche, der Rest bleibt ohne Score.
              </p>
            )}
          </section>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          <section className="space-y-4">
            {results.map((job) => (
              <JobCard
                key={job.url}
                job={job}
                jobId={jobIds[job.url]}
                onIgnore={() => ignoreJob(job)}
              />
            ))}
          </section>
        )}

        {/* No Results State */}
        {!loading && !error && searched && results.length === 0 && (
          <section className="bg-surface rounded-2xl p-16 text-center border border-border">
            <p className="text-primary-soft">
              Keine Jobs gefunden — versuch andere Suchbegriffe oder Orte.
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
function StageRow({ done, text }: { done: boolean; text: string }) {
  return (
    <p className="flex items-center gap-2 text-sm">
      <span aria-hidden="true" className={done ? 'text-success' : 'text-accent'}>
        {done ? '✓' : '●'}
      </span>
      <span className={done ? 'text-success' : 'text-foreground'}>{text}</span>
    </p>
  )
}

function JobCard({
  job,
  jobId,
  onIgnore,
}: {
  job: SearchResult
  jobId?: string
  onIgnore: () => void
}) {
  const [confirming, setConfirming] = useState(false)

  // Eine Skala, ein Vokabular: semanticScore kommt als aiScore (1–10) an —
  // Prozentwerte sind hier Vergangenheit, damit klassischer und semantischer
  // Pfad dasselbe sagen
  const scoreColor = typeof job.aiScore === 'number' ? scoreTone(job.aiScore) : 'text-primary-soft'

  function handleIgnoreClick() {
    if (!confirming) {
      setConfirming(true)
      // Zwei-Klick-Bestätigung mit Rückfalleitung — kein versehentliches Ignorieren,
      // kein Modal
      setTimeout(() => setConfirming(false), 4000)
      return
    }
    setConfirming(false)
    onIgnore()
  }

  return (
    <div className="bg-surface rounded-2xl p-8 border border-border shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="px-3 py-1 rounded-full text-xs font-medium border border-border bg-border-soft text-foreground">
              {platformLabel(job.platform)}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border border-border bg-border-soft tabular-nums ${scoreColor}`}>
              {typeof job.aiScore === 'number' ? (
                <>
                  <span className="sr-only">KI-Score: {job.aiScore} von 10 — {scoreLabel(job.aiScore)}</span>
                  <span aria-hidden="true">Score {job.aiScore}/10</span>
                </>
              ) : (
                'Kein Score'
              )}
            </span>
          </div>
          <h3 className="text-xl font-medium text-foreground mb-1">
            {job.title}
          </h3>
          <p className="text-primary-soft">
            {[
              job.company || null,
              job.location || null,
            ]
              .filter(Boolean)
              .join(' · ') || 'Ohne Angabe'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 flex-shrink-0">
          {jobId && (
            <Link
              href={`/jobs/${jobId}`}
              className="px-5 py-2.5 bg-border-soft hover:bg-border text-foreground rounded-xl text-sm font-medium transition-colors"
            >
              In deiner Liste
            </Link>
          )}
          <button
            onClick={handleIgnoreClick}
            aria-label={confirming ? 'Ignorieren endgültig bestätigen' : `Job ${job.title} ignorieren`}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              confirming
                ? 'bg-error/10 text-error border border-error/20'
                : 'bg-border-soft hover:bg-border text-foreground'
            }`}
          >
            {confirming ? 'Sicher? Erneut klicken' : 'Ignorieren'}
          </button>
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 bg-accent hover:bg-accent-strong text-on-accent rounded-xl text-sm font-medium transition-colors"
          >
            Ansehen
          </a>
        </div>
      </div>

      {job.matchReason && (
        <div className="mb-4 p-4 bg-success/10 rounded-xl border border-success/20">
          <p className="text-sm font-medium text-success mb-1">Warum dieser Job passt:</p>
          <p className="text-sm text-foreground">{job.matchReason}</p>
        </div>
      )}

      {job.aiReason && !job.matchReason && (
        <div className="mb-4 p-4 bg-success/10 rounded-xl border border-success/20">
          <p className="text-sm font-medium text-success mb-1">KI-Einschätzung:</p>
          <p className="text-sm text-foreground">{job.aiReason}</p>
        </div>
      )}

      {job.strengths && job.strengths.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-foreground mb-2">Passt gut:</p>
          <div className="flex flex-wrap gap-2">
            {job.strengths.map((skill, i) => (
              <span key={i} className="px-3 py-1 bg-success/10 text-success text-sm rounded-full border border-success/20">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {job.gaps && job.gaps.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-foreground mb-2">Fehlt:</p>
          <div className="flex flex-wrap gap-2">
            {job.gaps.map((gap, i) => (
              <span key={i} className="px-3 py-1 bg-error/10 text-error text-sm rounded-full border border-error/20">
                {gap}
              </span>
            ))}
          </div>
        </div>
      )}

      {job.transferableSkills && job.transferableSkills.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-foreground mb-2">Übertragbare Stärken:</p>
          <div className="flex flex-wrap gap-2">
            {job.transferableSkills.map((skill, i) => (
              <span key={i} className="px-3 py-1 bg-border-soft text-foreground text-sm rounded-full">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-sm text-primary-soft line-clamp-3 leading-relaxed">
        {job.description ? textSnippet(job.description) : ''}
      </p>
    </div>
  )
}
