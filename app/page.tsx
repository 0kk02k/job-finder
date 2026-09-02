'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button, ButtonLink, HIGH_MATCH_THRESHOLD, scoreTone } from './components/ui'

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
  lastNewJobs: number | null
}

// Pipeline-Status, die "erledigt" bedeuten — High Matches zählen nur ohne sie als "wartend"
const PIPELINE_AHEAD = ['APPLIED', 'INTERVIEW', 'OFFER']

export default function Dashboard() {
  const [stats, setStats] = useState<{ total: number; scored: number; applied: number } | null>(null)
  const [waitingCount, setWaitingCount] = useState(0)
  const [unscoredCount, setUnscoredCount] = useState(0)
  const [topMatches, setTopMatches] = useState<Job[]>([])
  const [hasResume, setHasResume] = useState(false)
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [jobsRes, resumeRes, searchesRes] = await Promise.all([
        fetch('/api/jobs'),
        fetch('/api/resume'),
        fetch('/api/searches'),
      ])

      if (!jobsRes.ok) throw new Error('jobs fetch failed')

      const jobs: Job[] = await jobsRes.json()
      if (!Array.isArray(jobs)) throw new Error('invalid jobs response')

      // Eine Menge, eine Semantik: alle Kennzahlen über dieselben aktiven Jobs
      const active = jobs.filter((j) => !['ARCHIVED', 'REJECTED'].includes(j.status))
      const scored = active.filter((j) => j.score != null)
      // Wartende High Matches: starke Treffer, die noch nicht in der Pipeline sind
      const waiting = active.filter(
        (j) => (j.score ?? 0) >= HIGH_MATCH_THRESHOLD && !PIPELINE_AHEAD.includes(j.status)
      )
      // Aktive Jobs ohne KI-Bewertung (z. B. lief die letzte Suche ohne KI)
      const unscored = active.filter((j) => j.score == null && !PIPELINE_AHEAD.includes(j.status))

      setStats({
        total: active.length,
        scored: scored.length,
        applied: active.filter((j) => PIPELINE_AHEAD.includes(j.status)).length,
      })
      setWaitingCount(waiting.length)
      setUnscoredCount(unscored.length)

      // Top 3 bewertete Jobs
      setTopMatches(
        [...scored].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3)
      )

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
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial- und Retry-Load: der Loading-Schalter setzt synchron vor dem await
    void loadAll()
  }, [loadAll])

  function getNextStep() {
    if (loading || error) return null

    if (!hasResume) {
      return {
        title: 'Lade dein Resume hoch',
        description:
          'Ohne Resume kann die KI keine Matches berechnen. Deine Daten bleiben in deiner privaten Instanz.',
        href: '/resume',
        cta: 'Resume hochladen',
      }
    }

    if (waitingCount > 0) {
      return {
        title: `${waitingCount} ${waitingCount === 1 ? 'High Match wartet' : 'High Matches warten'} auf dich`,
        description: 'Starke Matches, die noch nicht in deiner Bewerbungs-Pipeline sind.',
        href: '/jobs?filter=high_match',
        cta: 'High Matches ansehen',
      }
    }

    if (unscoredCount > 0) {
      return {
        title: `${unscoredCount} ${unscoredCount === 1 ? 'Job ist' : 'Jobs sind'} noch ohne KI-Bewertung`,
        description:
          'Die letzte Suche lief ohne KI-Matching. Starte eine semantische Suche, um sie gegen dein Resume einzuordnen.',
        href: '/search',
        cta: 'Semantisch suchen',
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
  const newJobsTotal = savedSearches.reduce((n, s) => n + (s.lastNewJobs ?? 0), 0)
  const showOnboarding = !loading && !error && stats != null && (!hasResume || stats.total === 0)

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-5xl mx-auto px-6 py-16" aria-busy={loading}>
        {/* Error State */}
        {error && (
          <section
            role="alert"
            className="mb-8 p-4 bg-error/10 rounded-xl border border-error/20"
          >
            <p className="text-sm text-error mb-3">
              Daten konnten nicht geladen werden. Prüfe deine Verbindung und versuch es erneut.
            </p>
            <Button size="sm" variant="secondary" onClick={() => void loadAll()}>
              Erneut versuchen
            </Button>
          </section>
        )}

        {/* Nächster Schritt — die eine Akzentfläche der Seite, mit der einzigen Primär-Aktion */}
        {!error && (nextStep ? (
          <section className="mb-12 bg-accent-soft/30 rounded-2xl p-8 border border-accent/20">
            <h1 className="text-3xl sm:text-4xl font-light text-foreground mb-3">
              {nextStep.title}
            </h1>
            <p className="text-primary leading-relaxed max-w-prose mb-6">
              {nextStep.description}
            </p>
            <ButtonLink href={nextStep.href}>{nextStep.cta}</ButtonLink>
          </section>
        ) : (
          <div className="mb-12 bg-surface rounded-2xl p-8 border border-border animate-pulse" aria-hidden="true">
            <div className="h-9 w-2/3 bg-border rounded mb-4" />
            <div className="h-4 w-1/2 bg-border-soft rounded mb-6" />
            <div className="h-12 w-44 bg-border-soft rounded-xl" />
          </div>
        ))}

        {/* Belegzeile — die Zahlen untermauern den nächsten Schritt, statt ihn zu ersetzen */}
        {!loading && !error && stats && (
          <p className="text-sm text-primary-soft mb-12 tabular-nums">
            <span className="font-medium text-foreground">{stats.total}</span> aktive Jobs ·{' '}
            {stats.scored} mit KI-Score · {stats.applied} beworben
          </p>
        )}

        {/* Top Matches */}
        {!loading && !error && topMatches.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-medium text-foreground mb-4">Top Matches</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {topMatches.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="bg-surface rounded-2xl p-5 border border-border-soft hover:border-accent transition-colors block"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-medium text-foreground line-clamp-2 text-sm" title={job.title}>
                      {job.title}
                    </p>
                    {job.score != null && (
                      <span className={`flex-shrink-0 text-lg font-light tabular-nums ${scoreTone(job.score)}`}>
                        {job.score}
                        <span className="text-xs text-primary-soft">/10</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-primary-soft">{job.company ?? 'Ohne Angabe'}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Saved Searches — der Wiederkomm-Trigger: „N neu" statt fünf gleichberechtigter CTAs */}
        {!loading && !error && savedSearches.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-medium text-foreground mb-4">
              Deine gespeicherten Suchen
            </h2>
            <div className="space-y-3">
              {savedSearches.map((saved) => (
                <div
                  key={saved.id}
                  className="flex items-center justify-between gap-4 bg-surface rounded-2xl p-5 border border-border-soft"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {saved.query}
                      {saved.location ? ` · ${saved.location}` : ''}
                      {saved.remote ? ' · Remote' : ''}
                    </p>
                    <p className="text-xs text-primary-soft mt-1 tabular-nums">
                      {saved.lastRunAt &&
                        `Zuletzt gesucht: ${new Date(saved.lastRunAt).toLocaleDateString('de-DE')}`}
                      {saved.lastRunAt && saved.lastNewJobs != null && saved.lastNewJobs > 0 && ' · '}
                      {saved.lastNewJobs != null && saved.lastNewJobs > 0 && (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20 font-medium">
                          {saved.lastNewJobs} neu
                        </span>
                      )}
                    </p>
                  </div>
                  <ButtonLink
                    href={`/search?saved=${saved.id}`}
                    variant="secondary"
                    size="sm"
                    className="flex-shrink-0"
                    aria-label={`„${saved.query}“ jetzt suchen`}
                  >
                    Jetzt suchen
                  </ButtonLink>
                </div>
              ))}
            </div>
            {newJobsTotal > 0 && (
              <p className="text-sm text-primary-soft mt-4 tabular-nums">
                Insgesamt {newJobsTotal} neue {newJobsTotal === 1 ? 'Job' : 'Jobs'} aus deinen
                gespeicherten Suchen.
              </p>
            )}
          </section>
        )}

        {/* Erste Schritte — nur, solange das Onboarding real unvollständig ist */}
        {showOnboarding && (
          <section className="bg-surface rounded-2xl p-10 border border-border">
            <h2 className="text-2xl font-medium text-foreground mb-8">Erste Schritte</h2>
            <div className="space-y-6 mb-10">
              <OnboardingStep
                step={1}
                done={hasResume}
                title="Resume hochladen"
                description="Lade deinen Lebenslauf als PDF hoch — die KI matcht alle Treffer dagegen."
              />
              <OnboardingStep
                step={2}
                done={(stats?.total ?? 0) > 0}
                title="Jobs suchen"
                description="Füge Jobs per URL hinzu oder starte eine Suche aus mehreren Quellen."
              />
              <OnboardingStep
                step={3}
                done={(stats?.scored ?? 0) > 0}
                title="KI-Matching"
                description="Die KI bewertet Treffer gegen dein Resume — nichts verlässt deine Instanz."
              />
              <OnboardingStep
                step={4}
                done={false}
                title="Unterlagen exportieren"
                description="Exportiere Resume und Anschreiben pro Job als PDF."
              />
            </div>

            <div className="flex flex-wrap gap-4">
              <ButtonLink href="/search" variant="secondary">
                Jobs suchen
              </ButtonLink>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

function OnboardingStep({ step, done, title, description }: { step: number; done: boolean; title: string; description: string }) {
  return (
    <div className="flex items-start gap-5">
      <div
        className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium tabular-nums border ${
          done
            ? 'bg-success/10 text-success border-success/20'
            : 'bg-accent text-on-accent border-transparent'
        }`}
        aria-label={done ? `${title} erledigt` : `Schritt ${step}: ${title}`}
      >
        {done ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          step
        )}
      </div>
      <div className="pt-1">
        <h3 className={`font-medium mb-1 ${done ? 'text-primary-soft' : 'text-foreground'}`}>
          {title}
          {done && <span className="sr-only"> (erledigt)</span>}
        </h3>
        <p className={`text-sm leading-relaxed ${done ? 'text-primary-soft/70' : 'text-primary-soft'}`}>
          {description}
        </p>
      </div>
    </div>
  )
}
