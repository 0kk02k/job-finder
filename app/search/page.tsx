'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

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

function SearchPageContent() {
  const searchParams = useSearchParams()
  const savedId = searchParams.get('saved')

  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [remote, setRemote] = useState(false)
  const [semantic, setSemantic] = useState(true)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [stats, setStats] = useState({ total: 0, highMatches: 0, newJobs: 0 })
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
    setError(null)
    setJustSaved(false)

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, location: loc, remote: rem, semantic: sem }),
      })

      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Suche fehlgeschlagen')
        setResults([])
        return
      }
      setResults(data.jobs || [])
      setStats({
        total: data.total,
        highMatches: data.highMatches,
        newJobs: data.newJobs || 0,
      })
      setSearched(true)

      // Update lastRunAt if this was a saved search
      if (savedSearchId) {
        fetch(`/api/searches/${savedSearchId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }).catch(() => {})
        fetchSavedSearches()
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

  function getScoreColor(score?: number) {
    if (!score) return 'text-[var(--color-primary-soft)]'
    if (score >= 8) return 'text-[var(--color-success)]'
    if (score >= 6) return 'text-[var(--color-warning)]'
    return 'text-[var(--color-error)]'
  }

  function getPlatformBadge(platform: string) {
    const badges: Record<string, string> = 'bg-purple-50 text-purple-700 border-purple-200|bg-blue-50 text-blue-700 border-blue-200|bg-green-50 text-green-700 border-green-200|bg-orange-50 text-orange-700 border-orange-200|bg-teal-50 text-teal-700 border-teal-200|bg-red-50 text-red-700 border-red-200|bg-amber-50 text-amber-700 border-amber-200|bg-cyan-50 text-cyan-700 border-cyan-200|bg-violet-50 text-violet-700 border-violet-200'.split('|').reduce((acc, val, i) => {
      const names = ['indeed', 'linkedin', 'glassdoor', 'ziprecruiter', 'xing', 'stepstone', 'jooble', 'remotive', 'arbeitnow']
      acc[names[i]] = val
      return acc
    }, {} as Record<string, string>)
    return badges[platform] || 'bg-zinc-50 text-zinc-700 border-zinc-200'
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">

      <main className="max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <section className="mb-12">
          <h1 className="text-3xl font-light text-[var(--color-foreground)] mb-3">
            Jobsuche
          </h1>
          <p className="text-lg text-[var(--color-primary-soft)]">
            KI-gestützte semantische Suche findet Jobs, die auch mit anderen Titeln passen.
          </p>
        </section>

        {/* Saved Searches */}
        {savedSearches.length > 0 && (
          <section className="mb-6">
            <p className="text-sm font-medium text-[var(--color-foreground)] mb-3">
              Gespeicherte Suchen
            </p>
            <div className="flex flex-wrap gap-2">
              {savedSearches.map((saved) => (
                <button
                  key={saved.id}
                  onClick={() => loadSavedSearch(saved)}
                  className="text-sm px-4 py-2 rounded-xl bg-[var(--color-border-soft)] text-[var(--color-foreground)] hover:bg-[var(--color-border)] transition-colors border border-[var(--color-border)]"
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
        <section className="bg-[var(--color-surface)] rounded-2xl p-8 border border-[var(--color-border)] shadow-sm mb-8">
          <form onSubmit={handleSearch} className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[var(--color-foreground)] mb-2">
                  Job Titel / Stichwort
                </label>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="z.B. Software Engineer, React Developer"
                  className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] placeholder:text-[var(--color-primary-soft)] focus:border-[var(--color-accent)] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-foreground)] mb-2">
                  Location (optional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="z.B. Berlin"
                    className="flex-1 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] placeholder:text-[var(--color-primary-soft)] focus:border-[var(--color-accent)] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-[var(--color-surface)] rounded-xl font-medium transition-colors disabled:opacity-50"
                  >
                    {loading ? '…' : 'Suchen'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remote}
                  onChange={(e) => setRemote(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
                />
                <span className="text-sm text-[var(--color-foreground)]">Nur Remote</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={semantic}
                  onChange={(e) => setSemantic(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
                />
                <span className="text-sm text-[var(--color-foreground)]">KI-Suche (Semantisches Matching)</span>
              </label>
            </div>
          </form>
        </section>

        {/* Error State */}
        {error && (
          <section className="mb-8 p-4 bg-[var(--color-error)]/10 rounded-xl border border-[var(--color-error)]/20">
            <p className="text-sm text-[var(--color-error)]">{error}</p>
          </section>
        )}

        {/* New Jobs Banner */}
        {!loading && searched && stats.newJobs > 0 && (
          <section className="mb-8 p-4 bg-[var(--color-success)]/10 rounded-xl border border-[var(--color-success)]/20 flex items-center justify-between">
            <p className="text-sm text-[var(--color-success)]">
              {stats.newJobs} {stats.newJobs === 1 ? 'neuer Job' : 'neue Jobs'} zu deiner Liste hinzugefügt
            </p>
            {!justSaved && (
              <button
                onClick={saveCurrentSearch}
                className="text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-accent)] transition-colors"
              >
                + Suche speichern
              </button>
            )}
            {justSaved && (
              <span className="text-sm text-[var(--color-primary-soft)]">✓ Gespeichert</span>
            )}
          </section>
        )}

        {/* Stats */}
        {!loading && results.length > 0 && (
          <section className="grid sm:grid-cols-2 gap-4 mb-8">
            <StatCard title="Jobs gefunden" value={stats.total.toString()} />
            <StatCard title="High Matches (≥7)" value={stats.highMatches.toString()} highlight />
          </section>
        )}

        {/* Results */}
        {results.length > 0 && (
          <section className="space-y-4">
            {results.map((job, index) => (
              <JobCard key={index} job={job} getScoreColor={getScoreColor} getPlatformBadge={getPlatformBadge} />
            ))}
          </section>
        )}

        {/* No Results State */}
        {!loading && !error && searched && results.length === 0 && (
          <section className="bg-[var(--color-surface)] rounded-2xl p-16 text-center border border-[var(--color-border)]">
            <p className="text-[var(--color-primary-soft)]">
              Keine Jobs gefunden — versuch andere Suchbegriffe oder Orte.
            </p>
          </section>
        )}

        {/* Empty State */}
        {!loading && results.length === 0 && query === '' && !searched && (
          <section className="bg-[var(--color-surface)] rounded-2xl p-16 text-center border border-[var(--color-border)]">
            <p className="text-[var(--color-primary-soft)] mb-2">
              Gib einen Suchbegriff ein, um Jobs zu finden.
            </p>
            <p className="text-sm text-[var(--color-primary-soft)]">
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
    <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border-soft)]">
      <p className="text-sm text-[var(--color-primary-soft)] mb-1">{title}</p>
      <p className={`text-3xl font-light ${highlight ? 'text-[var(--color-success)]' : 'text-[var(--color-foreground)]'}`}>
        {value}
      </p>
    </div>
  )
}

function JobCard({
  job,
  getScoreColor,
  getPlatformBadge,
}: {
  job: SearchResult
  getScoreColor: (score?: number) => string
  getPlatformBadge: (platform: string) => string
}) {
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl p-8 border border-[var(--color-border)] shadow-sm">
      <div className="flex items-start justify-between mb-5">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPlatformBadge(job.platform)}`}>
              {job.platform}
            </span>
            {job.aiScore && (
              <span className={`text-lg font-light ${getScoreColor(job.aiScore)}`}>
                {job.aiScore}/10
              </span>
            )}
            {job.relevanceScore && (
              <span className={`text-lg font-light ${getScoreColor(Math.round(job.relevanceScore * 10))}`}>
                {Math.round(job.relevanceScore * 100)}%
              </span>
            )}
          </div>
          <h3 className="text-xl font-medium text-[var(--color-foreground)] mb-1">
            {job.title}
          </h3>
          <p className="text-[var(--color-primary-soft)]">
            {job.company} • {job.location}
          </p>
        </div>
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-5 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-[var(--color-surface)] rounded-xl text-sm font-medium transition-colors"
        >
          Ansehen
        </a>
      </div>

      {job.matchReason && (
        <div className="mb-4 p-4 bg-[var(--color-success)]/10 rounded-xl border border-[var(--color-success)]/20">
          <p className="text-sm font-medium text-[var(--color-success)] mb-1">Warum dieser Job passt:</p>
          <p className="text-sm text-[var(--color-foreground)]">{job.matchReason}</p>
        </div>
      )}

      {job.aiReason && !job.matchReason && (
        <div className="mb-4 p-4 bg-[var(--color-success)]/10 rounded-xl border border-[var(--color-success)]/20">
          <p className="text-sm font-medium text-[var(--color-success)] mb-1">KI-Einschätzung:</p>
          <p className="text-sm text-[var(--color-foreground)]">{job.aiReason}</p>
        </div>
      )}

      {job.strengths && job.strengths.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-[var(--color-foreground)] mb-2">Passt gut:</p>
          <div className="flex flex-wrap gap-2">
            {job.strengths.map((skill, i) => (
              <span key={i} className="px-3 py-1 bg-[var(--color-success)]/10 text-[var(--color-success)] text-sm rounded-full border border-[var(--color-success)]/20">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {job.gaps && job.gaps.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-[var(--color-foreground)] mb-2">Fehlt:</p>
          <div className="flex flex-wrap gap-2">
            {job.gaps.map((gap, i) => (
              <span key={i} className="px-3 py-1 bg-[var(--color-error)]/10 text-[var(--color-error)] text-sm rounded-full border border-[var(--color-error)]/20">
                {gap}
              </span>
            ))}
          </div>
        </div>
      )}

      {job.transferableSkills && job.transferableSkills.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-[var(--color-foreground)] mb-2">Transferable Skills:</p>
          <div className="flex flex-wrap gap-2">
            {job.transferableSkills.map((skill, i) => (
              <span key={i} className="px-3 py-1 bg-[var(--color-border-soft)] text-[var(--color-foreground)] text-sm rounded-full">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-sm text-[var(--color-primary-soft)] line-clamp-3 leading-relaxed">
        {job.description?.substring(0, 300)}…
      </p>
    </div>
  )
}
