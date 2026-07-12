'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

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

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchJobs()
  }, [])

  async function fetchJobs() {
    try {
      const response = await fetch('/api/jobs')
      const data = await response.json()
      setJobs(data)
    } catch (error) {
      console.error('Failed to fetch jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(jobId: string, status: string) {
    await fetch(`/api/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchJobs()
  }

  function getStatusBadge(status: string) {
    const badges: Record<string, { label: string; class: string }> = {
      DISCOVERED: { label: 'Entdeckt', class: 'bg-zinc-50 text-zinc-700 border-zinc-200' },
      SCORED: { label: 'Bewertet', class: 'bg-blue-50 text-blue-700 border-blue-200' },
      HIGH_MATCH: { label: 'Top Match', class: 'bg-green-50 text-green-700 border-green-200' },
      APPLIED: { label: 'Beworben', class: 'bg-purple-50 text-purple-700 border-purple-200' },
      INTERVIEW: { label: 'Interview', class: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
      OFFER: { label: 'Angebot', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      REJECTED: { label: 'Abgelehnt', class: 'bg-red-50 text-red-700 border-red-200' },
      ARCHIVED: { label: 'Archiviert', class: 'bg-gray-50 text-gray-700 border-gray-200' },
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

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Navigation */}
      <nav className="border-b border-[var(--color-border)] bg-[var(--color-surface)] backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-medium text-[var(--color-foreground)]">
              Job Finder
            </Link>
            <div className="flex items-center gap-8">
              <NavLink href="/resume">Resume</NavLink>
              <NavLink href="/settings">Einstellungen</NavLink>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <section className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-3xl font-light text-[var(--color-foreground)] mb-2">
              Jobs
            </h1>
            <p className="text-[var(--color-primary-soft)]">
              {jobs.length} {jobs.length === 1 ? 'Job' : 'Jobs'}
            </p>
          </div>
          <Link
            href="/jobs/new"
            className="inline-flex items-center justify-center px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-[var(--color-surface)] rounded-xl font-medium transition-colors"
          >
            + Job hinzufügen
          </Link>
        </section>

        {/* Empty State */}
        {jobs.length === 0 ? (
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
          /* Job List */
          <section className="space-y-4">
            {jobs.map((job) => {
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
