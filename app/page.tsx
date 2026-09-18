'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button, ButtonLink, StatusBadge, HIGH_MATCH_THRESHOLD, ScoreBadge } from './components/ui'
import { SCORE_LIMIT } from '@/lib/search'
import { isBacklogJob } from '@/lib/status'

interface Job {
  id: string
  title: string
  company: string | null
  location: string | null
  url: string | null
  status: string
  score: number | null
  scoreReason: string | null
  matchDetails: string | null
  createdAt: string
  updatedAt: string
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

// Quelle sichtbar machen: das Portal, das den Treffer geliefert hat (aus der URL
// abgeleitet — Herkunft ist Teil der Klick-Entscheidung, Jooble klickt sich anders an
// als Remotive). Unbekannte Hosts fallen auf den Hostnamen zurück, nie auf „Quelle".
const SOURCE_LABELS: Record<string, string> = {
  'jooble.org': 'Jooble',
  'remotive.com': 'Remotive',
  'arbeitnow.com': 'Arbeitnow',
  'linkedin.com': 'LinkedIn',
  'stepstone.de': 'StepStone',
  'xing.com': 'XING',
  'indeed.com': 'Indeed',
}

function sourceLabel(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    const known = Object.keys(SOURCE_LABELS).find((k) => host === k || host.endsWith(`.${k}`))
    return known ? SOURCE_LABELS[known] : host
  } catch {
    return null
  }
}

// „vor 9 Tagen" statt „09.08.2026" — Staleness muss keiner selbst rechnen;
// ab 30 Tagen spricht das absolute Datum, weil „vor 74 Tagen" nichts mehr sagt.
function relativeDays(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS)
  if (days <= 0) return 'heute'
  if (days === 1) return 'gestern'
  if (days < 30) return `vor ${days} Tagen`
  return `am ${new Date(iso).toLocaleDateString('de-DE')}`
}

// Jobs laden ist der Trunk der Seite — sein Zustand entscheidet, was überhaupt behauptet werden darf.
// `auth` (Sitzung abgelaufen) ist bewusst getrennt von `error` (Netzwerk/Server):
// dieselbe Meldung für beides war eine falsche Diagnose. Innerhalb von `error` ist
// Netzwerk wieder getrennt von Server — „prüfe deine Verbindung" ist nur dort wahr.
type JobsState = 'loading' | 'ok' | 'auth' | 'error'
type JobsError = { kind: 'network' | 'server'; status?: number }

// Der Hero ist ein Launcher, kein Einbahn-Befehl: die App wählt nicht mehr,
// sie fragt. Eine Option = eine echte Antwort; was nicht existiert, wird nicht gezeigt.
interface LauncherOption {
  label: string
  description: string
  href: string
  primary?: boolean
}

export default function Dashboard() {
  const [jobsState, setJobsState] = useState<JobsState>('loading')
  const [jobsError, setJobsError] = useState<JobsError | null>(null)
  const [stats, setStats] = useState<{ total: number; totalAll: number; scored: number; applied: number } | null>(null)
  const [unscoredCount, setUnscoredCount] = useState(0)
  const [unscoredAllCount, setUnscoredAllCount] = useState(0)
  const [newThisWeek, setNewThisWeek] = useState(0)
  const [topMatches, setTopMatches] = useState<Job[]>([])
  // null = unbekannt (lädt oder Resume-API fehlgeschlagen) — niemals „kein Resume" behaupten, wenn wir es nicht wissen
  const [hasResume, setHasResume] = useState<boolean | null>(null)
  const [resumeError, setResumeError] = useState(false)
  // Präferenz-Profil: dieselbe Disziplin — null heißt unbekannt, nie „nicht erledigt"
  const [hasPreferenceProfile, setHasPreferenceProfile] = useState<boolean | null>(null)
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [searchesError, setSearchesError] = useState(false)
  const [refreshError, setRefreshError] = useState(false)
  // Erneut versuchen darf die Seite nicht aufs Skeleton zurückwerfen — der Inhalt bleibt stehen
  const hasLoadedOnce = useRef(false)

  const loadAll = useCallback(async () => {
    const isFirstLoad = !hasLoadedOnce.current
    if (isFirstLoad) setJobsState('loading')
    setJobsError(null)
    setResumeError(false)
    setSearchesError(false)
    try {
      const [jobsRes, resumeRes, searchesRes, prefRes] = await Promise.all([
        fetch('/api/jobs'),
        fetch('/api/resume'),
        fetch('/api/searches'),
        fetch('/api/preferences?light=1'),
      ])

      if (jobsRes.status === 401 || resumeRes.status === 401 || searchesRes.status === 401 || prefRes.status === 401) {
        setJobsState('auth')
        return
      }

      if (!jobsRes.ok) {
        if (isFirstLoad) {
          setJobsError({ kind: 'server', status: jobsRes.status })
          setJobsState('error')
        } else {
          setRefreshError(true)
        }
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
      // Der Rückstand — dieselbe Definition wie auf /jobs und in der
      // score-batch-Route (isBacklogJob): Score fehlt und weder archiviert
      // noch abgelehnt. Der Schnitt über aktive Jobs trägt dasselbe Ergebnis,
      // die Funktion macht die Definition aber zur einzigen Quelle.
      const unscoredAll = active.filter(isBacklogJob)
      // Handlungsfähiger Teil: unbewertet UND nicht schon in der Pipeline
      const unscored = unscoredAll.filter((j) => !PIPELINE_AHEAD.includes(j.status))
      const weekAgo = Date.now() - WEEK_MS
      const fresh = active.filter((j) => new Date(j.createdAt).getTime() >= weekAgo)

      setStats({
        total: active.length,
        totalAll: jobs.length,
        scored: scored.length,
        applied: active.filter((j) => PIPELINE_AHEAD.includes(j.status)).length,
      })
      setUnscoredCount(unscored.length)

      setUnscoredAllCount(unscoredAll.length)
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

      // Präferenz-Profil-Flag — bei Fehler bleibt es null („unbekannt“) und wird
      // nie zu einem falschen „erledigt“ umgedeutet.
      if (prefRes.ok) {
        const data = await prefRes.json().catch(() => undefined)
        if (data && typeof data.hasProfile === 'boolean') {
          setHasPreferenceProfile(data.hasProfile)
        }
      }
    } catch {
      // fetch wirft bei echten Netzwerkproblemen — nur hier ist „Verbindung prüfen" die wahre Diagnose
      if (isFirstLoad) {
        setJobsError({ kind: 'network' })
        setJobsState('error')
      } else {
        setRefreshError(true)
      }
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial- und Retry-Load: der State-Wechsel setzt synchron vor dem await
    void loadAll()
  }, [loadAll])

  // Der Launcher: was es gibt, als gleichwertige Wege — keine Empfehlung mit
  // verkleidetem Vorwurf. „Vergangene Funde" ohne Altersangabe: ein Fehlstand
  // ist ein Zustand des Bewertungsmodells (Scores entstehen bei der Suche),
  // keine Versäumnis des Nutzers.
  function getLauncherOptions(): LauncherOption[] {
    if (jobsState !== 'ok' || !stats) return []

    // Resume — nur behaupten, wenn der Zustand sicher bekannt ist. Fehlt der
    // Lebenslauf, gibt es genau eine echte Antwort; die Frage bleibt trotzdem stehen.
    if (hasResume === false) {
      return [
        {
          label: 'Lebenslauf hochladen',
          description:
            'Ohne Lebenslauf kann die KI keine Matches berechnen.',
          href: '/resume',
          primary: true,
        },
      ]
    }

    const options: LauncherOption[] = [
      {
        label: 'Neue Suche starten',
        description: 'Treffer finden und gegen deinen Lebenslauf bewerten lassen.',
        href: '/search',
        primary: true,
      },
    ]
    if (unscoredCount > 0) {
      options.push({
        label: 'Vergangene Funde durchsehen',
        description:
          unscoredCount === 1
            ? '1 Fund aus deinen Suchen hat noch keine Bewertung.'
            : `${unscoredCount} Funde aus deinen Suchen haben noch keine Bewertung.`,
        href: '/jobs?filter=unscored&sort=oldest',
      })
    }
    // Die eigene Bewerbungstätigkeit statt Treffer-Versprechen: was du in
    // Bewegung gesetzt hast, mit Terminen, Notizen und Wiedervorlage
    if (stats.applied > 0) {
      options.push({
        label: 'Bewerbungen im Blick',
        description: `${stats.applied} laufende ${stats.applied === 1 ? 'Bewerbung' : 'Bewerbungen'} — Termine, Notizen, Wiedervorlage.`,
        href: '/applications',
      })
    }
    if (savedSearches.length > 0) {
      options.push({
        label: 'Gespeicherte Suchen ansehen',
        description: `${savedSearches.length} ${savedSearches.length === 1 ? 'Suche' : 'Suchen'} ${
          newThisWeek === 0
            ? 'ohne neue Funde diese Woche'
            : `mit ${newThisWeek} ${newThisWeek === 1 ? 'neuem Fund' : 'neuen Funden'} diese Woche`
        }.`,
        href: '#gespeicherte-suchen',
      })
    }
    return options
  }

  const newJobsTotal = savedSearches.reduce((n, s) => n + (s.lastNewJobs ?? 0), 0)
  const launcherOptions = getLauncherOptions()
  // Onboarding nur bei sicher bekanntem Zustand — ein Resume-API-Fehler wird nicht zum
  // Onboarding umgedeutet. „Leer" heißt: wirklich leer (totalAll, alle Jobs inkl.
  // archiviert/abgelehnt) — wer eine geleerte Pipeline hat, bekommt kein Anfänger-Onboarding zurück.
  const showOnboarding =
    jobsState === 'ok' && stats != null && !resumeError && (hasResume === false || stats.totalAll === 0)

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
      title: 'Präferenz-Gespräch führen',
      description:
        'Vier Fragen zu Freude, Gewichtung, No-Gos und Entwicklung — das Ergebnis fließt in Bewertung und Suche ein.',
      done: hasPreferenceProfile === true,
      href: '/preferences',
      cta: 'Gespräch starten',
    },
    {
      step: 3,
      title: 'Jobs suchen und bewerten lassen',
      description:
        'Suche nach einem Beruf oder Ort — die KI bewertet die Treffer gegen deinen Lebenslauf.',
      done: (stats?.total ?? 0) > 0 && (stats?.scored ?? 0) > 0,
      href: '/search',
      cta: 'Jetzt suchen',
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

        {/* Netzwerk- und Serverfehler — getrennte Diagnose: „Verbindung prüfen" nur bei
            echten Netzwerkproblemen; ein 500er liegt nicht an der Verbindung des Nutzers. */}
        {jobsState === 'error' && (
          <section role="alert" className="mb-8 p-4 bg-error/10 rounded-xl border border-error/20">
            <h1 className="text-lg font-medium text-foreground mb-1">
              Daten konnten nicht geladen werden
            </h1>
            <p className="text-sm text-primary mb-3">
              {jobsError?.kind === 'server'
                ? `Der Server meldet einen Fehler${jobsError.status ? ` (${jobsError.status})` : ''} — das liegt nicht an deiner Verbindung. Versuch es gleich noch einmal.`
                : 'Prüfe deine Verbindung und versuch es erneut.'}
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

        {/* Lade-Skelett in der Form des Launchers — Inhalt springt beim Laden nicht */}
        {jobsState === 'loading' && (
          <>
            {/* Lade-Text für Screenreader: das Skeleton allein ist aria-hidden und sagt nichts */}
            <p className="sr-only" role="status">
              Daten werden geladen …
            </p>
            <div className="mb-6 bg-accent-soft/30 rounded-2xl p-8 border border-accent/20 animate-pulse motion-reduce:animate-none" aria-hidden="true">
              <div className="h-9 w-2/3 bg-border rounded mb-6" />
              <div className="flex flex-wrap gap-3">
                <div className="h-24 w-full sm:w-64 bg-surface/60 rounded-xl" />
                <div className="h-24 w-full sm:w-64 bg-surface/60 rounded-xl" />
                <div className="h-24 w-full sm:w-64 bg-surface/60 rounded-xl" />
              </div>
            </div>
            {/* Skelette für die unteren Sektionen — ohne sie springt der Inhalt beim Laden nach unten */}
            <div className="mt-12 space-y-4 animate-pulse motion-reduce:animate-none" aria-hidden="true">
              <div className="h-8 w-56 bg-border rounded mb-6" />
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="h-36 bg-surface border border-border-soft rounded-2xl" />
                <div className="h-36 bg-surface border border-border-soft rounded-2xl" />
                <div className="h-36 bg-surface border border-border-soft rounded-2xl" />
              </div>
              <div className="h-8 w-64 bg-border rounded mt-10 mb-6" />
              <div className="h-20 bg-surface border border-border-soft rounded-2xl" />
              <div className="h-20 bg-surface border border-border-soft rounded-2xl" />
            </div>
          </>
        )}
        {/* Einstiegs-Launcher — die eine Akzentfläche der Seite. Die App fragt,
            womit man starten will, statt einen nächsten Schritt zu verordnen.
            Genau eine Option ist primär (die eine Ocker-Fläche), die anderen
            sind gleichwertige Wege — auch der zurückhaltende. */}
        {jobsState !== 'loading' && jobsState !== 'auth' && jobsState !== 'error' && launcherOptions.length > 0 && (
          <section className="mb-6 bg-accent-soft/30 rounded-2xl p-8 border border-accent/20">
            <h1 className="text-3xl sm:text-4xl font-light text-foreground mb-6">
              Womit willst du starten?
            </h1>

            <div className="flex flex-wrap gap-3">
              {launcherOptions.map((option) => (
                <Link
                  key={option.href}
                  href={option.href}
                  className={`flex-1 min-w-[15rem] rounded-xl border p-4 transition-colors ${
                    option.primary
                      ? 'bg-accent hover:bg-accent-strong text-on-accent border-transparent'
                      : 'bg-surface hover:border-selection border-border'
                  }`}
                >
                  <span className="block font-medium">{option.label}</span>
                  <span
                    className={`block mt-1 text-sm leading-relaxed ${
                      option.primary ? 'text-on-accent' : 'text-primary-soft'
                    }`}
                  >
                    {option.description}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Erste Schritte — direkt nach dem Launcher. Nur der aktuelle Schritt
            trägt einen Button (der Weg dorthin), die Karte bleibt die Landkarte. */}
        {showOnboarding && (
          <section className="bg-surface rounded-2xl p-10 border border-border mb-6">
            <h2 className="text-2xl font-medium text-foreground mb-8">Erste Schritte</h2>
            {/* ol statt div-Reihe: die Reihenfolge ist echtes Inhalt —
                Screenreader kündigen Position an, ohne aria-label auf div zu setzen */}
            <ol className="space-y-6">
              {onboardingSteps.map((step, i) => (
                <OnboardingStep
                  key={step.step}
                  step={step.step}
                  title={step.title}
                  description={step.description}
                  href={step.href}
                  cta={step.cta}
                  state={step.done ? 'done' : i === firstOpenStep ? 'current' : 'upcoming'}
                />
              ))}
            </ol>
            <p className="mt-8 text-sm text-primary-soft">
              Warum die Suche findet, was sie findet:{' '}
              <Link href="/so-funktionierts" className="text-selection hover:text-foreground">
                So funktioniert’s
              </Link>
            </p>
          </section>
        )}

        {/* Belegzeile — zwei Zeiträume, zwei Sätze: „neu" ist immer die letzte Woche aus
            gespeicherten Suchen; die Bestandszahlen stehen ohne Zeitrahmen und heißen
            „aktiv" (derselbe Schnitt wie überall auf dieser Seite). Rechts: der
            Refresh-Control, damit Wiederkommen nicht den Umweg über /jobs braucht. */}
        {jobsState === 'ok' && stats && !showOnboarding && (
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 mb-12">
            <div className="text-sm text-primary tabular-nums">
              {savedSearches.length > 0 && (
                <p className="mb-1">
                  Diese Woche:{' '}
                  {newThisWeek === 0 ? (
                    'keine neuen Funde'
                  ) : (
                    <span className="font-medium text-foreground whitespace-nowrap">
                      {newThisWeek} {newThisWeek === 1 ? 'neuer Fund' : 'neue Funde'}
                    </span>
                  )}{' '}
                  aus deinen gespeicherten Suchen.
                </p>
              )}
              <p>
                <span className="whitespace-nowrap">
                  Rückstand:{' '}
                  <span className="font-medium text-foreground">
                    {unscoredAllCount} von {stats.total}
                  </span>{' '}
                  aktiven Jobs unbewertet
                </span>{' '}
                · <span className="whitespace-nowrap">{stats.applied} in der Pipeline</span>
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => void loadAll()}>
              Aktualisieren
            </Button>
          </div>
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

        {/* Top Matches — mit Beweis, nicht als Nacktzahl. Im Onboarding ausgeblendet:
            Wer hört „ohne Lebenslauf keine Matches", darf keine Scores sehen. */}
        {jobsState === 'ok' && !showOnboarding && topMatches.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-medium text-foreground mb-4">Top Matches</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {topMatches.map((job) => {
                const proof = matchProof(job)
                const source = sourceLabel(job.url)
                return (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="bg-surface rounded-2xl p-5 border border-border-soft hover:border-selection transition-colors block"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-medium text-foreground line-clamp-2 text-sm" title={job.title}>
                        {job.title}
                      </p>
                      {job.score != null && (
                        <ScoreBadge score={job.score} className="flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-primary-soft">
                      {job.company ?? 'Ohne Angabe'}
                      {source && <> · {source}</>}
                    </p>
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

        {/* Leer-Ausgabe statt stumm verschwindender Sektion: der Grund, warum hier
            nichts steht, und der Ausweg — Scores entstehen bei der Suche (SCORE_LIMIT pro Suche). */}
        {jobsState === 'ok' && !showOnboarding && topMatches.length === 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-medium text-foreground mb-4">Top Matches</h2>
            <div className="bg-surface rounded-2xl p-8 border border-border-soft">
              <p className="font-medium text-foreground mb-1">Noch keine bewerteten Jobs</p>
              <p className="text-sm text-primary leading-relaxed max-w-prose mb-5">
                Bewertungen entstehen bei der Suche — die KI bewertet dort bis zu {SCORE_LIMIT} Treffer
                gegen deinen Lebenslauf.
              </p>
              <ButtonLink href="/search" variant="secondary" size="sm">
                Jetzt suchen
              </ButtonLink>
            </div>
          </section>
        )}

        {/* Saved Searches — der Wiederkomm-Trigger; im Onboarding ausgeblendet.
            Anker-Ziel des Launcher-Options „Gespeicherte Suchen ansehen“;
            scroll-mt hält den Abstand zur klebenden Navigation. */}
        {jobsState === 'ok' && !showOnboarding && savedSearches.length > 0 && (
          <section id="gespeicherte-suchen" className="mb-12 scroll-mt-24">
            <h2 className="text-xl font-medium text-foreground mb-4">
              Deine gespeicherten Suchen
            </h2>
            <div className="space-y-3">
              {savedSearches.map((saved) => (
                <div
                  key={saved.id}
                  className="flex items-center justify-between gap-4 bg-surface rounded-2xl p-5 border border-border-soft"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {saved.query}
                      {saved.location ? ` · ${saved.location}` : ''}
                      {saved.remote ? ' · Remote' : ''}
                    </p>
                    <p className="text-xs text-primary-soft mt-1 tabular-nums">
                      {saved.lastRunAt
                        ? `Zuletzt gesucht: ${relativeDays(saved.lastRunAt)}`
                        : 'Noch nie gesucht'}
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
                Speichere eine Suche — ab dann zählt sie dir bei jedem Öffnen die neuen Jobs.
              </p>
              <ButtonLink href="/search" variant="secondary" size="sm">
                Erste Suche starten
              </ButtonLink>
            </div>
          </section>
        )}

        {/* Gescheiterte Suche-Liste bleibt sichtbar statt still zu verschwinden */}
        {jobsState === 'ok' && !showOnboarding && searchesError && savedSearches.length === 0 && (
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
      </main>
    </div>
  )
}

// Beweiszeile aus echten Matching-Daten — nicht erfunden, nur was die KI hinterlegt hat.
// Sprachliche Regel: ab der High-Match-Schwelle (8) belegt die Zeile, sie relativiert
// nicht — neben einem grünen Score steht kein „Lücke". Unter der Schwelle (6–7, „gut
// mit kleinen Lücken") zeigt sie die Lücke, statt sie zu verbergen.
function matchProof(job: Job): { label: string; values: string[] } | null {
  if (!job.matchDetails) return null
  try {
    const d = JSON.parse(job.matchDetails) as Record<string, unknown>
    const strings = (v: unknown) =>
      Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []
    const isHighMatch = (job.score ?? 0) >= HIGH_MATCH_THRESHOLD
    // Dedupe: dieselbe generische Stärke zweimal ist Beugung, kein Beleg
    const strengths = [...new Set(strings(d.strengths))]
    if (strengths.length > 0) {
      return { label: isHighMatch ? 'Passt' : 'Stärken', values: strengths.slice(0, 2) }
    }
    const transferable = [...new Set(strings(d.transferableSkills))]
    if (transferable.length > 0) {
      return { label: isHighMatch ? 'Passt auf' : 'Übertragbar', values: transferable.slice(0, 2) }
    }
    const gaps = strings(d.gaps)
    if (gaps.length > 0 && !isHighMatch) {
      return { label: 'Lücke', values: gaps.slice(0, 1) }
    }
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
  href,
  cta,
}: {
  step: number
  state: StepState
  title: string
  description: string
  href?: string
  cta?: string
}) {
  const marker =
    state === 'done'
      ? 'bg-success/10 text-success border-success/20'
      : state === 'current'
        ? 'bg-selection text-on-selection border-transparent'
        : 'bg-transparent text-primary-soft border-border'
  return (
    <li className="flex items-start gap-5" aria-current={state === 'current' ? 'step' : undefined}>
      {/* Nummer/Häkchen rein visuell — die ol-Semantik trägt die Position,
          das sr-only „(erledigt)" im Titel den Zustand */}
      <div
        aria-hidden="true"
        className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium tabular-nums border ${marker}`}
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
        {/* Nur der aktuelle Schritt ist ein Weg — erledigte und kommende bleiben
            Kartenpunkte, damit die Liste nicht zu einem zweiten Launcher wird. */}
        {state === 'current' && href && cta && (
          <Link
            href={href}
            className="inline-flex items-center justify-center mt-3 px-5 py-2.5 bg-accent hover:bg-accent-strong text-on-accent rounded-xl font-medium text-sm transition-colors"
          >
            {cta}
          </Link>
        )}
      </div>
    </li>
  )
}
