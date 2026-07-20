'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Job {
  id: string
  title: string
  company: string | null
  status: string
  score: number | null
}

interface SavedSearch {
  id: string
  query: string
  location: string | null
  remote: boolean
  semantic: boolean
  lastRunAt: string | null
}

export default function Dashboard() {
  const [stats, setStats] = useState<{ total: number; highMatches: number; applied: number } | null>(null)
  const [topMatches, setTopMatches] = useState<Job[]>([])
  const [hasResume, setHasResume] = useState(false)
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function loadAll() {
      try {
        const [jobsRes, resumeRes, searchesRes] = await Promise.all([
          fetch('/api/jobs'),
          fetch('/api/resume'),
          fetch('/api/searches'),
        ])

        if (!jobsRes.ok) throw new Error('jobs fetch failed')

        const jobs: Job[] = await jobsRes.json()
        if (!Array.isArray(jobs)) throw new Error('invalid jobs response')

        const active = jobs.filter((j) => !['ARCHIVED', 'REJECTED'].includes(j.status))
        setStats({
          total: active.length,
          highMatches: active.filter((j) => j.status === 'HIGH_MATCH' || (j.score ?? 0) >= 7).length,
          applied: jobs.filter((j) => ['APPLIED', 'INTERVIEW', 'OFFER'].includes(j.status)).length,
        })

        // Top 3 scored jobs
        const matches = jobs
          .filter((j) => ['HIGH_MATCH', 'SCORED'].includes(j.status) && j.score != null)
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
          .slice(0, 3)
        setTopMatches(matches)

        // Resume check
        if (resumeRes.ok) {
          const resume = await resumeRes.json()
          setHasResume(resume != null)
        }

        // Saved searches
        if (searchesRes.ok) {
          const data = await searchesRes.json()
          if (Array.isArray(data)) setSavedSearches(data)
        }
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [])

  function getNextStep() {
    if (loading || error) return null

    if (!hasResume) {
      return {
        title: 'Lade dein Resume hoch',
        description: 'Ohne Resume kann die KI keine Matches berechnen.',
        href: '/resume',
        cta: 'Resume hochladen',
      }
    }

    if (stats && stats.highMatches > 0 && stats.applied < stats.highMatches) {
      const unapplied = stats.highMatches - stats.applied
      return {
        title: `${unapplied} ${unapplied === 1 ? 'High Match wartet' : 'High Matches warten'} auf dich`,
        description: 'Du hast starke Matches, die du noch nicht beworben hast.',
        href: '/jobs',
        cta: 'Jobs ansehen',
      }
    }

    return {
      title: 'Starte eine neue Suche',
      description: 'Finde neue Jobs, die zu deinem Profil passen.',
      href: '/search',
      cta: 'Jobs suchen',
    }
  }

  const nextStep = getNextStep()

  return (
    <div className="min-h-screen bg-[var(--background)]">

      <main className="max-w-5xl mx-auto px-6 py-16">
        {/* Welcome Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-light text-[var(--color-foreground)] mb-3">
            Willkommen zurück
          </h2>
          <p className="text-lg text-[var(--color-primary-soft)]">
            Verwalte deine Bewerbungen einfach und strukturiert.
          </p>
        </section>

        {/* Error State */}
        {error && (
          <section className="mb-8 p-4 bg-[var(--color-error)]/10 rounded-xl border border-[var(--color-error)]/20">
            <p className="text-sm text-[var(--color-error)]">
              Daten konnten nicht geladen werden. Bitte lade die Seite neu.
            </p>
          </section>
        )}

        {/* Stats Overview */}
        <section className="grid sm:grid-cols-3 gap-6 mb-8">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : stats ? (
            <>
              <StatCard title="Jobs gefunden" value={String(stats.total)} subtitle="Gesamt gespeichert" />
              <StatCard title="Matches" value={String(stats.highMatches)} subtitle="High score ≥ 7" />
              <StatCard title="Beworben" value={String(stats.applied)} subtitle="Erfolgreich gesendet" />
            </>
          ) : null}
        </section>

        {/* Nächster Schritt */}
        {nextStep && (
          <section className="mb-8 bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-[var(--color-primary-soft)] mb-1">Nächster Schritt</p>
              <h3 className="text-lg font-medium text-[var(--color-foreground)] mb-1">
                {nextStep.title}
              </h3>
              <p className="text-sm text-[var(--color-primary-soft)]">{nextStep.description}</p>
            </div>
            <Link
              href={nextStep.href}
              className="flex-shrink-0 text-sm px-5 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-[var(--color-surface)] rounded-xl font-medium transition-colors"
            >
              {nextStep.cta}
            </Link>
          </section>
        )}

        {/* Top High Matches */}
        {!loading && !error && topMatches.length > 0 && (
          <section className="mb-8">
            <h3 className="text-xl font-medium text-[var(--color-foreground)] mb-4">
              Top Matches
            </h3>
            <div className="grid sm:grid-cols-3 gap-4">
              {topMatches.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="bg-[var(--color-surface)] rounded-2xl p-5 border border-[var(--color-border-soft)] hover:border-[var(--color-accent)] transition-colors block"
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-medium text-[var(--color-foreground)] line-clamp-2 text-sm">
                      {job.title}
                    </p>
                    {job.score != null && (
                      <span className="flex-shrink-0 ml-2 text-lg font-light text-[var(--color-success)]">
                        {job.score}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-primary-soft)]">{job.company}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Saved Searches */}
        {savedSearches.length > 0 && (
          <section className="mb-8">
            <h3 className="text-xl font-medium text-[var(--color-foreground)] mb-4">
              Deine gespeicherten Suchen
            </h3>
            <div className="space-y-3">
              {savedSearches.map((saved) => (
                <div
                  key={saved.id}
                  className="flex items-center justify-between bg-[var(--color-surface)] rounded-2xl p-5 border border-[var(--color-border-soft)]"
                >
                  <div>
                    <p className="font-medium text-[var(--color-foreground)]">
                      {saved.query}
                      {saved.location ? ` · ${saved.location}` : ''}
                      {saved.remote ? ' · Remote' : ''}
                    </p>
                    {saved.lastRunAt && (
                      <p className="text-xs text-[var(--color-primary-soft)] mt-1">
                        Zuletzt gesucht: {new Date(saved.lastRunAt).toLocaleDateString('de-DE')}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/search?saved=${saved.id}`}
                    className="text-sm px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-[var(--color-surface)] rounded-xl font-medium transition-colors"
                  >
                    Jetzt suchen
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Getting Started */}
        <section className="bg-[var(--color-surface)] rounded-2xl p-10 border border-[var(--color-border)] shadow-sm">
          <h3 className="text-2xl font-medium text-[var(--color-foreground)] mb-8">
            Erste Schritte
          </h3>
          <div className="space-y-6 mb-10">
            <StepCard step={1} title="Resume hochladen" description="Lade deinen Lebenslauf als PDF oder Markdown hoch" />
            <StepCard step={2} title="Jobs suchen" description="Füge Jobs per URL oder manuell hinzu" />
            <StepCard step={3} title="KI-Matching" description="Lass die KI Jobs bewerten und Matches finden" />
            <StepCard step={4} title="Unterlagen exportieren" description="Exportiere angepasste Resumes und Anschreiben als PDF" />
          </div>

          <div className="flex flex-wrap gap-4">
            <PrimaryButton href="/search">Jobs suchen</PrimaryButton>
            <SecondaryButton href="/resume">Resume hochladen</SecondaryButton>
          </div>
        </section>
      </main>
    </div>
  )
}

function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl p-8 border border-[var(--color-border-soft)]">
      <p className="text-sm text-[var(--color-primary-soft)] mb-2">{title}</p>
      <p className="text-4xl font-light text-[var(--color-foreground)] mb-1">{value}</p>
      <p className="text-xs text-[var(--color-primary-soft)]">{subtitle}</p>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl p-8 border border-[var(--color-border-soft)] animate-pulse">
      <div className="h-4 w-24 bg-[var(--color-border)] rounded mb-3" />
      <div className="h-10 w-16 bg-[var(--color-border)] rounded mb-2" />
      <div className="h-3 w-20 bg-[var(--color-border-soft)] rounded" />
    </div>
  )
}

function StepCard({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <div className="flex items-start gap-5">
      <div className="flex-shrink-0 w-9 h-9 bg-[var(--color-primary)] text-[var(--color-surface)] rounded-full flex items-center justify-center text-sm font-medium">
        {step}
      </div>
      <div className="pt-1">
        <h4 className="font-medium text-[var(--color-foreground)] mb-1">{title}</h4>
        <p className="text-sm text-[var(--color-primary-soft)] leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

function PrimaryButton({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-[var(--color-surface)] rounded-xl font-medium transition-colors"
    >
      {children}
    </Link>
  )
}

function SecondaryButton({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center px-6 py-3 bg-[var(--color-border-soft)] hover:bg-[var(--color-border)] text-[var(--color-foreground)] rounded-xl font-medium transition-colors"
    >
      {children}
    </Link>
  )
}
