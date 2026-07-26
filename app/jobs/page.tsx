'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '../components/Toast'
import { ButtonLink, StatusBadge } from '../components/ui'

interface Job {
  id: string
  title: string
  company: string | null
  location: string | null
  url: string
  status: string
  score: number | null
  createdAt: string
}

const ALL_STATUSES = [
  'DISCOVERED',
  'SCORED',
  'HIGH_MATCH',
  'APPLIED',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
  'ARCHIVED',
] as const

const STATUS_LABELS: Record<string, string> = {
  DISCOVERED: 'Entdeckt',
  SCORED: 'Bewertet',
  HIGH_MATCH: 'Top Match',
  APPLIED: 'Beworben',
  INTERVIEW: 'Interview',
  OFFER: 'Angebot',
  REJECTED: 'Abgelehnt',
  ARCHIVED: 'Archiviert',
}

const DEFAULT_HIDDEN = new Set(['ARCHIVED', 'REJECTED'])

type SortOption = 'newest' | 'score' | 'company'

export default function JobsPage() {
  const router = useRouter()
  const toast = useToast()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(
    () => new Set(ALL_STATUSES.filter((s) => !DEFAULT_HIDDEN.has(s)))
  )
  const [highMatchOnly, setHighMatchOnly] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('newest')

  useEffect(() => {
    fetchJobs()
  }, [])

  async function fetchJobs() {
    try {
      const response = await fetch('/api/jobs')
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
        }
        setJobs([])
        return
      }
      const data = await response.json()
      setJobs(data)
    } catch (error) {
      console.error('Failed to fetch jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(jobId: string, status: string) {
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) {
        toast.error('Status konnte nicht aktualisiert werden')
        return
      }
      fetchJobs()
    } catch {
      toast.error('Status konnte nicht aktualisiert werden')
    }
  }

  const filteredJobs = useMemo(() => {
    let result = jobs.filter((job) => activeStatuses.has(job.status))

    if (highMatchOnly) {
      result = result.filter((job) => (job.score ?? 0) >= 7)
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (job) =>
          job.title.toLowerCase().includes(q) ||
          (job.company ?? '').toLowerCase().includes(q)
      )
    }

    switch (sortBy) {
      case 'score':
        result = [...result].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        break
      case 'company':
        result = [...result].sort((a, b) =>
          (a.company ?? '').localeCompare(b.company ?? '')
        )
        break
      default:
        result = [...result].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
    }

    return result
  }, [jobs, activeStatuses, highMatchOnly, search, sortBy])

  function toggleStatus(status: string) {
    setActiveStatuses((prev) => {
      const next = new Set(prev)
      if (next.has(status)) {
        next.delete(status)
      } else {
        next.add(status)
      }
      return next
    })
  }

  function resetFilters() {
    setSearch('')
    setActiveStatuses(new Set(ALL_STATUSES.filter((s) => !DEFAULT_HIDDEN.has(s))))
    setHighMatchOnly(false)
    setSortBy('newest')
  }

  function getScoreColor(score: number | null) {
    if (!score) return 'text-primary-soft'
    if (score >= 8) return 'text-success'
    if (score >= 6) return 'text-warning'
    return 'text-error'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="max-w-5xl mx-auto px-6 py-16">
          <section className="flex items-center justify-between mb-8 animate-pulse">
            <div>
              <div className="h-8 w-32 bg-border rounded mb-2" />
              <div className="h-4 w-24 bg-border-soft rounded" />
            </div>
            <div className="h-12 w-40 bg-border-soft rounded-xl" />
          </section>
          <section className="space-y-4 animate-pulse">
            <SkeletonJobCard />
            <SkeletonJobCard />
            <SkeletonJobCard />
          </section>
        </main>
      </div>
    )
  }

  const defaultActive: Set<string> = new Set(ALL_STATUSES.filter((s) => !DEFAULT_HIDDEN.has(s)))
  const hasActiveFilters =
    search.trim() !== '' ||
    highMatchOnly ||
    activeStatuses.size !== defaultActive.size ||
    [...activeStatuses].some((s) => !defaultActive.has(s))

  return (
    <div className="min-h-screen bg-background">

      <main className="max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <section className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-light text-foreground mb-2">
              Jobs
            </h1>
            <p className="text-primary-soft">
              {jobs.length} {jobs.length === 1 ? 'Job' : 'Jobs'} insgesamt
            </p>
          </div>
          <ButtonLink href="/jobs/new">
            + Job hinzufügen
          </ButtonLink>
        </section>

        {jobs.length === 0 ? (
          /* Empty State — no jobs at all */
          <section className="bg-surface rounded-2xl p-16 text-center border border-border">
            <p className="text-primary-soft mb-6">
              Noch keine Jobs gespeichert.
            </p>
            <ButtonLink href="/jobs/new">
              Ersten Job hinzufügen
            </ButtonLink>
          </section>
        ) : (
          <>
            {/* Filter Toolbar */}
            <section className="bg-surface rounded-2xl p-6 border border-border mb-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Titel oder Firma suchen..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-background border border-border text-foreground placeholder:text-primary-soft focus:outline-none focus:border-accent"
                />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="px-4 py-2.5 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:border-accent"
                >
                  <option value="newest">Neueste zuerst</option>
                  <option value="score">Score absteigend</option>
                  <option value="company">Firma A–Z</option>
                </select>
              </div>

              <div className="flex flex-wrap gap-2">
                {ALL_STATUSES.map((status) => {
                  const active = activeStatuses.has(status)
                  return (
                    <button
                      key={status}
                      onClick={() => toggleStatus(status)}
                      aria-pressed={active}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border ${
                        active
                          ? 'bg-accent text-on-accent border-accent'
                          : 'bg-border-soft text-primary-soft border-border'
                      }`}
                    >
                      {STATUS_LABELS[status]}
                    </button>
                  )
                })}
              </div>

              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={highMatchOnly}
                  onChange={(e) => setHighMatchOnly(e.target.checked)}
                  className="w-4 h-4 accent-accent"
                />
                <span className="text-sm text-foreground">
                  Nur High Matches (≥7)
                </span>
              </label>
            </section>

            {/* Result Counter */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-primary-soft tabular-nums">
                {filteredJobs.length} von {jobs.length} Jobs
              </p>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="text-sm text-primary hover:text-accent transition-colors"
                >
                  Filter zurücksetzen
                </button>
              )}
            </div>

            {filteredJobs.length === 0 ? (
              /* Empty State — filters yield nothing */
              <section className="bg-surface rounded-2xl p-16 text-center border border-border">
                <p className="text-primary-soft mb-6">
                  Keine Jobs für diese Filter.
                </p>
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center justify-center px-6 py-3 bg-accent hover:bg-accent-strong text-on-accent rounded-xl font-medium transition-colors"
                >
                  Filter zurücksetzen
                </button>
              </section>
            ) : (
              /* Job List */
              <section className="space-y-4">
                {filteredJobs.map((job) => (
                  <div
                    key={job.id}
                    className="bg-surface rounded-2xl p-8 border border-border shadow-sm"
                  >
                    <div className="flex items-start justify-between mb-5">
                      <div className="flex-1">
                        <Link href={`/jobs/${job.id}`}>
                          <h3 className="text-xl font-medium text-foreground hover:text-accent transition-colors mb-1">
                            {job.title}
                          </h3>
                        </Link>
                        <p className="text-primary-soft">
                          {job.company} • {job.location || 'Remote'}
                        </p>
                      </div>
                      {job.score && (
                        <div className={`text-3xl font-light tabular-nums ${getScoreColor(job.score)}`}>
                          {job.score}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <StatusBadge status={job.status} />
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:text-accent transition-colors"
                        >
                          Job ansehen →
                        </a>
                      </div>

                      <div className="flex gap-2">
                        <StatusButton
                          label="Beworben"
                          onClick={() => updateStatus(job.id, 'APPLIED')}
                          active={job.status === 'APPLIED'}
                        />
                        <StatusButton
                          label="Interview"
                          onClick={() => updateStatus(job.id, 'INTERVIEW')}
                          active={job.status === 'INTERVIEW'}
                        />
                        <StatusButton
                          label="Archiv"
                          onClick={() => updateStatus(job.id, 'ARCHIVED')}
                          active={job.status === 'ARCHIVED'}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function SkeletonJobCard() {
  return (
    <div className="bg-surface rounded-2xl p-8 border border-border-soft">
      <div className="flex items-start justify-between mb-5">
        <div className="flex-1">
          <div className="h-6 w-2/3 bg-border rounded mb-2" />
          <div className="h-4 w-1/3 bg-border-soft rounded" />
        </div>
        <div className="h-9 w-8 bg-border-soft rounded" />
      </div>
      <div className="flex items-center justify-between">
        <div className="h-7 w-24 bg-border-soft rounded-full" />
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-border-soft rounded-xl" />
          <div className="h-9 w-24 bg-border-soft rounded-xl" />
          <div className="h-9 w-20 bg-border-soft rounded-xl" />
        </div>
      </div>
    </div>
  )
}

function StatusButton({ label, onClick, active }: { label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`text-sm px-4 py-2 rounded-xl font-medium transition-colors ${
        active
          ? 'bg-accent text-on-accent'
          : 'bg-border-soft text-foreground hover:bg-border'
      }`}
    >
      {label}
    </button>
  )
}
