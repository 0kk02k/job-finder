'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button, ButtonLink, StatusBadge, HIGH_MATCH_THRESHOLD, scoreTone } from './components/ui'

interface Job {
  id: string
  title: string
  company: string | null
  status: string
  score: number | null
  scoreReason: string | null
  matchDetails: string | null
  createdAt: string
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

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS
// Das Angebot im Hero: so viele am längsten wartende Jobs zeigt es konkret
const OFFER_COUNT = 10

// Jobs laden ist der Trunk der Seite — sein Zustand entscheidet, was überhaupt behauptet werden darf.
// `auth` (Sitzung abgelaufen) ist bewusst getrennt von `error` (Netzwerk/Server):
// dieselbe Meldung für beides war eine falsche Diagnose.
type JobsState = 'loading' | 'ok' | 'auth' | 'error'

// Das Angebot im Hero: Jobs mit ausgerechneter Wartezeit (Ladezeit, nicht Renderzeit)
type OfferJob = Job & { daysWaiting: number }

interface NextStep {
  title: string
  description: string
  href: string
  cta: string
  // Das Angebot als konkrete Liste statt nackter Zahl — nur im unbewertet-Zweig
  jobs?: OfferJob[]
  // Das Widerwort gegen die Kaskaden-Meinung: der unterdrückte Zweig als Textlink
  alternative?: { label: string; href: string }
}

export default function Dashboard() {
  const [jobsState, setJobsState] = useState<JobsState>('loading')
  const [stats, setStats] = useState<{ total: number; scored: number; applied: number } | null>(null)
  const [waitingCount, setWaitingCount] = useState(0)
  const [unscoredCount, setUnscoredCount] = useState(0)
  const [unscoredAllCount, setUnscoredAllCount] = useState(0)
  const [oldestUnscored, setOldestUnscored] = useState<OfferJob[]>([])
  const [newThisWeek, setNewThisWeek] = useState(0)
  const [topMatches, setTopMatches] = useState<Job[]>([])
  // null = unbekannt (lädt oder Resume-API fehlgeschlagen) — niemals „kein Resume" behaupten, wenn wir es nicht wissen
  const [hasResume, setHasResume] = useState<boolean | null>(null)
  const [resumeError, setResumeError] = useState(false)
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [searchesError, setSearchesError] = useState(false)
  const [refreshError, setRefreshError] = useState(false)
  // Erneut versuchen darf die Seite nicht aufs Skeleton zurückwerfen — der Inhalt bleibt stehen
  const hasLoadedOnce = useRef(false)

  const loadAll = useCallback(async () => {
    const isFirstLoad = !hasLoadedOnce.current
    if (isFirstLoad) setJobsState('loading')
    setResumeError(false)
    setSearchesError(false)
    try {
      const [jobsRes, resumeRes, searchesRes] = await Promise.all([
        fetch('/api/jobs'),
        fetch('/api/resume'),
        fetch('/api/searches'),
      ])

      if (jobsRes.status === 401 || resumeRes.status === 401 || searchesRes.status === 401) {
        setJobsState('auth')
        return
      }

      if (!jobsRes.ok) {
        if (isFirstLoad) setJobsState('error')
        else setRefreshError(true)
        return
      }

      const jobs: Job[] = await jobsRes.json()
      if (!Array.isArray(jobs)) {
        if (isFirstLoad) setJobsState('error')
        else setRefreshError(true)
        return
      }

      // Eine Menge, eine Semantik: alle Kennzahlen über dieselben aktiven Jobs
      const active = jobs.filter((j) => !['ARCHIVED', 'REJECTED'].includes(j.status))
      const scored = active.filter((j) => j.score != null)
      // Wartende High Matches: starke Treffer, die noch nicht in der Pipeline sind
      const waiting = active.filter(
        (j) => (j.score ?? 0) >= HIGH_MATCH_THRESHOLD && !PIPELINE_AHEAD.includes(j.status)
      )
      // Ohne Bewertung — über die aktive Menge, identisch zum Zähler auf /jobs (Korpus-Wahrheit)
      const unscoredAll = active.filter((j) => j.score == null)
      // Handlungsfähiger Teil: unbewertet UND nicht schon in der Pipeline
      const unscored = unscoredAll.filter((j) => !PIPELINE_AHEAD.includes(j.status))
      const oldest = [...unscored]
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(0, OFFER_COUNT)
        .map((j) => ({
          ...j,
          daysWaiting: Math.max(0, Math.floor((Date.now() - new Date(j.createdAt).getTime()) / DAY_MS)),
        }))
      const weekAgo = Date.now() - WEEK_MS
      const fresh = active.filter((j) => new Date(j.createdAt).getTime() >= weekAgo)

      setStats({
        total: active.length,
        scored: scored.length,
        applied: active.filter((j) => PIPELINE_AHEAD.includes(j.status)).length,
      })
      setWaitingCount(waiting.length)
      setUnscoredCount(unscored.length)
      setUnscoredAllCount(unscoredAll.length)
      setOldestUnscored(oldest)
      setNewThisWeek(fresh.length)

      // Top 3 bewertete Jobs
      setTopMatches(
        [...scored].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3)
      )
      setJobsState('ok')
      hasLoadedOnce.current = true
      setRefreshError(false)

      // Resume-Check — ein Fehler hier bleibt ein Fehler und wird nicht zu „fehlt"
      if (resumeRes.ok) {
        const resume = await resumeRes.json().catch(() => undefined)
        if (resume === undefined) {
          setResumeError(true)
        } else {
          setHasResume(resume != null)
        }
      } else {
        setResumeError(true)
      }

      // Saved searches — bei Fehler bleiben bereits geladene Daten stehen (stale statt leer)
      if (searchesRes.ok) {
        const data = await searchesRes.json().catch(() => undefined)
        if (Array.isArray(data)) {
          setSavedSearches(data)
        } else {
          setSearchesError(true)
        }
      } else {
        setSearchesError(true)
      }
    } catch {
      if (isFirstLoad) setJobsState('error')
      else setRefreshError(true)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial- und Retry-Load: der State-Wechsel setzt synchron vor dem await
    void loadAll()
  }, [loadAll])

  function getNextStep(): NextStep | null {
    if (jobsState !== 'ok' || !stats) return null

    // Resume — nur behaupten, wenn der Zustand sicher bekannt ist
    if (hasResume === false) {
      return {
        title: 'Lade deinen Lebenslauf hoch',
        description:
          'Ohne Lebenslauf kann die KI keine Matches berechnen. Deine Daten bleiben in deiner privaten Instanz.',
        href: '/resume',
        cta: 'Lebenslauf hochladen',
      }
    }

    // Angebot statt Rückstand: die Kaskade zeigt nicht die Lücke, sondern den konkreten Einstieg
    if (unscoredCount > 0 && unscoredCount >= waitingCount) {
      return {
        title: 'Fang mit den am längsten wartenden an',
        description: `${unscoredAllCount} von ${stats.total} Jobs haben noch keine KI-Bewertung — diese ${oldestUnscored.length} warten am längsten.`,
        href: '/jobs?filter=unscored&sort=oldest',
        cta: 'Alle unbewerteten ansehen',
        jobs: oldestUnscored,
        alternative:
          waitingCount > 0
            ? { label: 'Lieber die High Matches ansehen', href: '/jobs?filter=high_match' }
            : undefined,
      }
    }

    if (waitingCount > 0) {
      return {
        title: `${waitingCount} ${waitingCount === 1 ? 'High Match wartet' : 'High Matches warten'} auf dich`,
        description: 'Starke Treffer, die noch nicht in deiner Pipeline sind.',
        href: '/jobs?filter=high_match',
        cta: 'High Matches ansehen',
        alternative:
          unscoredCount > 0
            ? { label: 'Lieber die unbewerteten ansehen', href: '/jobs?filter=unscored&sort=oldest' }
            : undefined,
      }
    }

    return {
      title: 'Starte eine neue Suche',
      description: 'Deine Pipeline ist aufgeräumt — Zeit für neue Kandidaten.',
      href: '/search',
      cta: 'Jobs suchen',
    }
  }

  const nextStep = getNextStep()
  const newJobsTotal = savedSearches.reduce((n, s) => n + (s.lastNewJobs ?? 0), 0)
  // Onboarding nur bei sicher bekanntem Zustand — ein Resume-API-Fehler wird nicht zum Onboarding umgedeutet
  const showOnboarding =
    jobsState === 'ok' && stats != null && !resumeError && (hasResume === false || stats.total === 0)

  // Genau ein aktueller Schritt: der erste noch offene — die Nummerierung trägt echte Ordnung
  const onboardingSteps = [
    {
      step: 1,
      title: 'Lebenslauf hochladen',
      description: 'Lade deinen Lebenslauf als PDF hoch — die KI matcht alle Treffer dagegen.',
      done: hasResume === true,
    },
    {
      step: 2,
      title: 'Jobs suchen',
      description: 'Füge Jobs per URL hinzu oder starte eine Suche aus mehreren Quellen.',
      done: (stats?.total ?? 0) > 0,
    },
    {
      step: 3,
      title: 'KI-Matching',
      description: 'Die KI bewertet Treffer gegen deinen Lebenslauf — nichts verlässt deine Instanz.',
      done: (stats?.scored ?? 0) > 0,
    },
  ]
  const firstOpenStep = onboardingSteps.findIndex((s) => !s.done)

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-5xl mx-auto px-6 py-16" aria-busy={jobsState === 'loading'}>
        {/* Sitzung abgelaufen — eigenes Problem, eigene Meldung, eigener Ausweg */}
        {jobsState === 'auth' && (
          <section
            role="alert"
            className="mb-12 bg-surface rounded-2xl p-10 border border-border"
          >
            <h1 className="text-3xl sm:text-4xl font-light text-foreground mb-3">
              Deine Anmeldung ist abgelaufen
            </h1>
            <p className="text-primary leading-relaxed max-w-prose mb-6">
              Aus Sicherheitsgründen ist deine Sitzung begrenzt. Deine Jobs, dein Lebenslauf und
              deine Bewertungen sind unberührt — melde dich einfach erneut an.
            </p>
            <ButtonLink href="/login">Erneut anmelden</ButtonLink>
          </section>
        )}

        {/* Netzwerk-/Serverfehler — nur hier ist „Verbindung prüfen" eine wahre Diagnose */}
        {jobsState === 'error' && (
          <section role="alert" className="mb-8 p-4 bg-error/10 rounded-xl border border-error/20">
            <h1 className="text-lg font-medium text-foreground mb-1">
              Daten konnten nicht geladen werden
            </h1>
            <p className="text-sm text-primary mb-3">
              Prüfe deine Verbindung und versuch es erneut.
            </p>
            <Button size="sm" variant="secondary" onClick={() => void loadAll()}>
              Erneut versuchen
            </Button>
          </section>
        )}

        {/* Aktualisierung fehlgeschlagen — der Inhalt bleibt stehen, nur der Hinweis kommt dazu */}
        {jobsState === 'ok' && refreshError && (
          <section
            role="alert"
            className="mb-8 p-4 bg-warning/10 rounded-xl border border-warning/20 flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm text-primary">
              Aktualisierung fehlgeschlagen — die Daten unten sind vom letzten Stand.
            </p>
            <Button size="sm" variant="secondary" onClick={() => void loadAll()}>
              Erneut versuchen
            </Button>
          </section>
        )}

        {/* Nächster Schritt — die eine Akzentfläche der Seite, mit der einzigen Primär-Aktion */}
        {jobsState === 'loading' && (
          <div className="mb-6 bg-accent-soft/30 rounded-2xl p-8 border border-accent/20 animate-pulse motion-reduce:animate-none" aria-hidden="true">
            <div className="h-9 w-2/3 bg-border rounded mb-4" />
            <div className="h-4 w-1/2 bg-border rounded mb-6" />
            <div className="h-12 w-44 bg-border rounded-xl" />
          </div>
        )}
        {jobsState !== 'loading' && jobsState !== 'auth' && jobsState !== 'error' && nextStep && (
          <section className="mb-6 bg-accent-soft/30 rounded-2xl p-8 border border-accent/20">
            <h1 className="text-3xl sm:text-4xl font-light text-foreground mb-3">
              {nextStep.title}
            </h1>
            <p className="text-primary leading-relaxed max-w-prose mb-6">
              {nextStep.description}
            </p>

            {/* Das Angebot als konkrete Liste: die am längsten wartenden, direkt anklickbar */}
            {nextStep.jobs && nextStep.jobs.length > 0 && (
              <ul className="border-y border-accent/20 divide-y divide-accent/20 mb-6">
                {nextStep.jobs.map((job) => (
                  <li key={job.id}>
                    <Link
                      href={`/jobs/${job.id}`}
                      className="flex items-center justify-between gap-4 py-2.5 group"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground truncate group-hover:text-accent-strong">
                          {job.title}
                        </span>
                        <span className="block text-xs text-primary truncate">
                          {job.company ?? 'Ohne Angabe'}
                        </span>
                      </span>
                      <span className="flex-shrink-0 text-xs text-primary tabular-nums whitespace-nowrap">
                        seit {job.daysWaiting} {job.daysWaiting === 1 ? 'Tag' : 'Tagen'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {/* Im Onboarding trägt die Erste-Schritte-Karte die eine Aktion — nicht zweimal */}
              {!showOnboarding && <ButtonLink href={nextStep.href}>{nextStep.cta}</ButtonLink>}
              {nextStep.alternative && !showOnboarding && (
                <Link
                  href={nextStep.alternative.href}
                  className="text-sm font-medium text-primary underline decoration-accent/60 underline-offset-4 hover:text-foreground hover:decoration-accent"
                >
                  {nextStep.alternative.label}
                </Link>
              )}
            </div>
          </section>
        )}

        {/* Belegzeile — persönliche Perspektive; Korpus-Zahl synchron zum Zähler auf /jobs; im Onboarding ausgeblendet */}
        {jobsState === 'ok' && stats && !showOnboarding && (
          <p className="text-sm text-primary mb-12 tabular-nums">
            Deine letzten 7 Tage:{' '}
            <span className="font-medium text-foreground whitespace-nowrap">
              {newThisWeek} {newThisWeek === 1 ? 'neuer Fund' : 'neue Funde'}
            </span>{' '}
            ·{' '}
            <span className="whitespace-nowrap">
              <span className="font-medium text-foreground">
                {unscoredAllCount} von {stats.total}
              </span>{' '}
              Jobs ohne Bewertung
            </span>{' '}
            ·{' '}
            <span className="whitespace-nowrap">{stats.applied} in der Pipeline</span>
          </p>
        )}

        {/* Lebenslauf-Status unbekannt — ein API-Fehler wird nicht zu „lade dein Resume hoch" umgedeutet */}
        {jobsState === 'ok' && resumeError && (
          <section
            role="status"
            className="mb-8 p-4 bg-warning/10 rounded-xl border border-warning/20 flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm text-primary">
              Dein Lebenslauf-Status konnte nicht geladen werden — manche Hinweise sind deshalb
              ausgeblendet.
            </p>
            <Button size="sm" variant="secondary" onClick={() => void loadAll()}>
              Erneut versuchen
            </Button>
          </section>
        )}

        {/* Top Matches — mit Beweis, nicht als Nacktzahl */}
        {jobsState === 'ok' && topMatches.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-medium text-foreground mb-4">Top Matches</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {topMatches.map((job) => {
                const proof = matchProof(job)
                return (
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
                        <span
                          className={`flex-shrink-0 text-lg font-light tabular-nums ${scoreTone(job.score)}`}
                          title={`KI-Score — High Match ab ${HIGH_MATCH_THRESHOLD}`}
                        >
                          {job.score}
                          <span className="text-xs text-primary-soft">/10</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-primary-soft">{job.company ?? 'Ohne Angabe'}</p>
                    {proof && (
                      <p className="mt-2 text-xs text-primary leading-relaxed">
                        {proof.label}: {proof.values.join(', ')}
                      </p>
                    )}
                    {/* Status nur, wo er Erinnerungsarbeit leistet: die Pipeline-Stufen */}
                    {PIPELINE_AHEAD.includes(job.status) && (
                      <div className="mt-3">
                        <StatusBadge status={job.status} />
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Saved Searches — der Wiederkomm-Trigger: „N neu" statt fünf gleichberechtigter CTAs */}
        {jobsState === 'ok' && savedSearches.length > 0 && (
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
                    aria-label={`${saved.query} jetzt suchen`}
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

        {/* On-Ramp für den Wiederkomm-Mechanismus: sichtbar machen, was gespeicherte Suchen bringen */}
        {jobsState === 'ok' && !searchesError && !showOnboarding && savedSearches.length === 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-medium text-foreground mb-4">Deine gespeicherten Suchen</h2>
            <div className="bg-surface rounded-2xl p-8 border border-border-soft">
              <p className="font-medium text-foreground mb-1">Noch keine gespeicherte Suche</p>
              <p className="text-sm text-primary leading-relaxed max-w-prose mb-5">
                Speichere eine Suche, und wir zählen dir künftig die neuen Jobs — beim nächsten
                Öffnen siehst du sofort, was sich getan hat.
              </p>
              <ButtonLink href="/search" variant="secondary" size="sm">
                Erste Suche starten
              </ButtonLink>
            </div>
          </section>
        )}

        {/* Gescheiterte Suche-Liste bleibt sichtbar statt still zu verschwinden */}
        {jobsState === 'ok' && searchesError && savedSearches.length === 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-medium text-foreground mb-4">Deine gespeicherten Suchen</h2>
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-3 p-4 bg-warning/10 rounded-xl border border-warning/20"
            >
              <p className="text-sm text-primary">Gespeicherte Suchen konnten nicht geladen werden.</p>
              <Button size="sm" variant="secondary" onClick={() => void loadAll()}>
                Erneut versuchen
              </Button>
            </div>
          </section>
        )}

        {/* Erste Schritte — genau ein aktueller Schritt, die Karte trägt die eine Aktion */}
        {showOnboarding && (
          <section className="bg-surface rounded-2xl p-10 border border-border">
            <h2 className="text-2xl font-medium text-foreground mb-8">Erste Schritte</h2>
            <div className="space-y-6 mb-10">
              {onboardingSteps.map((step, i) => (
                <OnboardingStep
                  key={step.step}
                  step={step.step}
                  title={step.title}
                  description={step.description}
                  state={step.done ? 'done' : i === firstOpenStep ? 'current' : 'upcoming'}
                />
              ))}
            </div>

            {nextStep && <ButtonLink href={nextStep.href}>{nextStep.cta}</ButtonLink>}
          </section>
        )}
      </main>
    </div>
  )
}

// Beweiszeile aus echten Matching-Daten — nicht erfunden, nur was die KI hinterlegt hat
function matchProof(job: Job): { label: string; values: string[] } | null {
  if (!job.matchDetails) return null
  try {
    const d = JSON.parse(job.matchDetails) as Record<string, unknown>
    const strings = (v: unknown) =>
      Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []
    const strengths = strings(d.strengths)
    if (strengths.length > 0) return { label: 'Passt', values: strengths.slice(0, 2) }
    const transferable = strings(d.transferableSkills)
    if (transferable.length > 0) return { label: 'Übertragbar', values: transferable.slice(0, 2) }
    const gaps = strings(d.gaps)
    if (gaps.length > 0) return { label: 'Lücke', values: gaps.slice(0, 1) }
    return null
  } catch {
    return null
  }
}

type StepState = 'done' | 'current' | 'upcoming'

function OnboardingStep({
  step,
  state,
  title,
  description,
}: {
  step: number
  state: StepState
  title: string
  description: string
}) {
  const marker =
    state === 'done'
      ? 'bg-success/10 text-success border-success/20'
      : state === 'current'
        ? 'bg-accent text-on-accent border-transparent'
        : 'bg-transparent text-primary-soft border-border'
  return (
    <div className="flex items-start gap-5" aria-current={state === 'current' ? 'step' : undefined}>
      <div
        className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium tabular-nums border ${marker}`}
        aria-label={
          state === 'done' ? `${title} erledigt` : state === 'current' ? `Schritt ${step}: ${title}` : title
        }
      >
        {state === 'done' ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          step
        )}
      </div>
      <div className="pt-1">
        <h3 className={`font-medium mb-1 ${state === 'done' ? 'text-primary-soft' : 'text-foreground'}`}>
          {title}
          {state === 'done' && <span className="sr-only"> (erledigt)</span>}
        </h3>
        <p className="text-sm leading-relaxed text-primary-soft">{description}</p>
      </div>
    </div>
  )
}
