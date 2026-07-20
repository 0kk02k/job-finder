'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '../components/Toast'

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

  function getStatusBadge(status: string) {
    const badges: Record<string, { label: string; class: string }> = {
      DISCOVERED: { label: 'Entdeckt', class: 'bg-[var(--color-border-soft)] text-[var(--color-foreground)] border-[var(--color-border)]' },
      SCORED: { label: 'Bewertet', class: 'bg-[var(--color-border-soft)] text-[var(--color-foreground)] border-[var(--color-border)]' },
      HIGH_MATCH: { label: 'Top Match', class: 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20' },
      APPLIED: { label: 'Beworben', class: 'bg-[var(--color-accent-soft)]/30 text-[var(--color-foreground)] border-[var(--color-border)]' },
      INTERVIEW: { label: 'Interview', class: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/20' },
      OFFER: { label: 'Angebot', class: 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20' },
      REJECTED: { label: 'Abgelehnt', class: 'bg-[var(--color-error)]/10 text-[var(--color-error)] border-[var(--color-error)]/20' },
      ARCHIVED: { label: 'Archiviert', class: 'bg-[var(--color-border-soft)] text-[var(--color-primary-soft)] border-[var(--color-border)]' },
    }
    return badges[status] || badges.DISCOVERED
  }

  function getScoreColor(score: number | null) {
    if (!score) return 'text-[var(--color-primary-soft)]'
    if (score >= 8) return 'text-[var(--color-success)]'
    if (score >= 6) return 'text-[var(--color-warning)]'
    return 'text-[var(--color-error)]'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <p className="text-[var(--color-primary-soft)]">Lade Jobs...</p>
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
    <div className="min-h-screen bg-[var(--background)]">

      <main className="max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <section className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-light text-[var(--color-foreground)] mb-2">
              Jobs
            </h1>
            <p className="text-[var(--color-primary-soft)]">
              {jobs.length} {jobs.length === 1 ? 'Job' : 'Jobs'} insgesamt
            </p>
          </div>
          <Link
            href="/jobs/new"
            className="inline-flex items-center justify-center px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-[var(--color-surface)] rounded-xl font-medium transition-colors"
          >
            + Job hinzufügen
          </Link>
        </section>

        {jobs.length === 0 ? (
          /* Empty State — no jobs at all */
          <section className="bg-[var(--color-surface)] rounded-2xl p-16 text-center border border-[var(--color-border)]">
            <p className="text-[var(--color-primary-soft)] mb-6">
              Noch keine Jobs gespeichert.
            </p>
            <Link
              href="/jobs/new"
              className="inline-flex items-center justify-center px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-[var(--color-surface)] rounded-xl font-medium transition-colors"
            >
              Ersten Job hinzufügen
            </Link>
          </section>
        ) : (
          <>
            {/* Filter Toolbar */}
            <section className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] mb-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Titel oder Firma suchen..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--color-border)] text-[var(--color-foreground)] placeholder:text-[var(--color-primary-soft)] focus:outline-none focus:border-[var(--color-accent)]"
                />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="px-4 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--color-border)] text-[var(--color-foreground)] focus:outline-none focus:border-[var(--color-accent)]"
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
                      className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border ${
                        active
                          ? 'bg-[var(--color-primary)] text-[var(--color-surface)] border-[var(--color-primary)]'
                          : 'bg-[var(--color-border-soft)] text-[var(--color-primary-soft)] border-[var(--color-border)]'
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
                  className="w-4 h-4 accent-[var(--color-primary)]"
                />
                <span className="text-sm text-[var(--color-foreground)]">
                  Nur High Matches (≥7)
                </span>
              </label>
            </section>

            {/* Result Counter */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-[var(--color-primary-soft)]">
                {filteredJobs.length} von {jobs.length} Jobs
              </p>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="text-sm text-[var(--color-primary)] hover:text-[var(--color-accent)] transition-colors"
                >
                  Filter zurücksetzen
                </button>
              )}
            </div>

            {filteredJobs.length === 0 ? (
              /* Empty State — filters yield nothing */
              <section className="bg-[var(--color-surface)] rounded-2xl p-16 text-center border border-[var(--color-border)]">
                <p className="text-[var(--color-primary-soft)] mb-6">
                  Keine Jobs für diese Filter.
                </p>
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center justify-center px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-[var(--color-surface)] rounded-xl font-medium transition-colors"
                >
                  Filter zurücksetzen
                </button>
              </section>
            ) : (
              /* Job List */
              <section className="space-y-4">
                {filteredJobs.map((job) => {
                  const statusBadge = getStatusBadge(job.status)
                  return (
                    <div
                      key={job.id}
                      className="bg-[var(--color-surface)] rounded-2xl p-8 border border-[var(--color-border)] shadow-sm"
                    >
                      <div className="flex items-start justify-between mb-5">
                        <div className="flex-1">
                          <Link href={`/jobs/${job.id}`}>
                            <h3 className="text-xl font-medium text-[var(--color-foreground)] hover:text-[var(--color-accent)] transition-colors mb-1">
                              {job.title}
                            </h3>
                          </Link>
                          <p className="text-[var(--color-primary-soft)]">
                            {job.company} • {job.location || 'Remote'}
                          </p>
                        </div>
                        {job.score && (
                          <div className={`text-3xl font-light ${getScoreColor(job.score)}`}>
                            {job.score}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-medium border ${statusBadge.class}`}>
                            {statusBadge.label}
                          </span>
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-[var(--color-primary)] hover:text-[var(--color-accent)] transition-colors"
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
                  )
                })}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function StatusButton({ label, onClick, active }: { label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`text-sm px-4 py-2 rounded-xl font-medium transition-colors ${
        active
          ? 'bg-[var(--color-primary)] text-[var(--color-surface)]'
          : 'bg-[var(--color-border-soft)] text-[var(--color-foreground)] hover:bg-[var(--color-border)]'
      }`}
    >
      {label}
    </button>
  )
}
