'use client'

import { useState } from 'react'
import Link from 'next/link'

interface SearchResult {
  title: string
  company: string
  location: string
  description: string
  url: string
  platform: string
  aiScore?: number
  aiReason?: string
  relevanceScore?: number
  matchReason?: string
  transferableSkills?: string[]
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [remote, setRemote] = useState(false)
  const [semantic, setSemantic] = useState(true)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [stats, setStats] = useState({ total: 0, highMatches: 0 })
  const [isSemantic, setIsSemantic] = useState(false)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResults([])

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, location, remote, semantic }),
      })

      const data = await response.json()
      setResults(data.jobs || [])
      setStats({ total: data.total, highMatches: data.highMatches })
      setIsSemantic(data.semantic || false)
    } catch (error) {
      alert('Fehler bei der Suche')
    } finally {
      setLoading(false)
    }
  }

  function getScoreColor(score?: number) {
    if (!score) return 'text-[var(--color-primary-soft)]'
    if (score >= 8) return 'text-[var(--color-success)]'
    if (score >= 6) return 'text-[var(--color-warning)]'
    return 'text-[var(--color-error)]'
  }

  function getPlatformBadge(platform: string) {
    const badges: Record<string, string> = {
      indeed: 'bg-purple-50 text-purple-700 border-purple-200',
      linkedin: 'bg-blue-50 text-blue-700 border-blue-200',
      glassdoor: 'bg-green-50 text-green-700 border-green-200',
      ziprecruiter: 'bg-orange-50 text-orange-700 border-orange-200',
      xing: 'bg-teal-50 text-teal-700 border-teal-200',
      stepstone: 'bg-red-50 text-red-700 border-red-200',
    }
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

        {/* Empty State */}
        {!loading && results.length === 0 && query === '' && (
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

function NavLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="text-[var(--color-primary-soft)] hover:text-[var(--color-foreground)] text-sm font-medium transition-colors"
    >
      {children}
    </Link>
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
