'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '../components/Toast'
import { Button, ButtonLink, StatusBadge, StatusButton, HIGH_MATCH_THRESHOLD, ScoreBadge } from '../components/ui'
import { STATUS_LABELS, isBacklogJob } from '@/lib/status'
import { SCORE_LIMIT } from '@/lib/search'

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

// Kern-Status stehen offen, der Rest hinter einer Disclosure — >12 sichtbare
// Kontrollen an einem Entscheidungspunkt überfordern (Working Memory ≤ 4).
// Wer einen Mehr-Status aktiv filtert, sieht die Gruppe aufgeklappt.
const CORE_STATUSES = ['DISCOVERED', 'HIGH_MATCH', 'APPLIED', 'INTERVIEW'] as const
const MORE_STATUSES = ALL_STATUSES.filter((s) => !(CORE_STATUSES as readonly string[]).includes(s))

const DEFAULT_HIDDEN = new Set(['ARCHIVED', 'REJECTED'])

type SortOption = 'newest' | 'oldest' | 'score' | 'company'

// Bewertungsstand als Vier-Wege-Auswahl: „Top Matches" ersetzt die frühere
// separate High-Match-Checkbox — ein Entscheidungspunkt statt zwei.
type ScoreFilter = 'all' | 'top' | 'scored' | 'unscored'

export default function JobsPage() {
  const router = useRouter()
  const toast = useToast()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  // Fehler beim Laden — kein stiller „0 Jobs": eigene Meldung mit Wiederholung
  const [loadError, setLoadError] = useState(false)

  const [search, setSearch] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(
    () => new Set(ALL_STATUSES.filter((s) => !DEFAULT_HIDDEN.has(s)))
  )
  const [showMoreStatuses, setShowMoreStatuses] = useState(false)
  // Deep-Links aus dem Dashboard: /jobs?filter=high_match · /jobs?filter=unscored
  // (und /jobs?filter=scored — „all" ist die Abwesenheit des Parameters)
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>(() => {
    if (typeof window === 'undefined') return 'all'
    const filter = new URLSearchParams(window.location.search).get('filter')
    return filter === 'unscored' ? 'unscored' : filter === 'scored' ? 'scored' : filter === 'high_match' ? 'top' : 'all'
  })
  // Batch-Scoring: der Server begrenzt jeden Lauf, die Fläche loopt bis der
  // Rückstand trocken ist — Fortschritt gegen den Rückstand am Laufbeginn,
  // nicht gegen die gefilterte Sicht (der Server bewertet global)
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchDone, setBatchDone] = useState(0)
  const [batchTotal, setBatchTotal] = useState(0)
  // Was nach dem Lauf noch offen ist — die 20-Lauf-Hartgrenze bricht sonst still ab
  const [batchRemaining, setBatchRemaining] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    if (typeof window === 'undefined') return 'newest'
    // Deep-Link aus dem Dashboard: die am längsten wartenden zuerst
    return new URLSearchParams(window.location.search).get('sort') === 'oldest' ? 'oldest' : 'newest'
  })

  // Mehrfachauswahl für Sammelaktionen — der Rückstand wird in Etappen abgearbeitet
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  // Tastatur-Wegweiser (j/k): der markierte Job folgt der Tastatur, Enter öffnet
  const [highlightId, setHighlightId] = useState<string | null>(null)
  // Batch-Abbruch auf Wunsch — der Rückstand wird in Etappen abgearbeitet,
  // aber nie gegen den Willen der Nutzerin
  const batchAbortRef = useRef(false)

  useEffect(() => {
    fetchJobs()
  }, [])

  async function fetchJobs() {
    try {
      const response = await fetch('/api/jobs')
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        setLoadError(true)
        return
      }
      const data = await response.json()
      setJobs(data)
      setLoadError(false)
    } catch (error) {
      console.error('Failed to fetch jobs:', error)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(jobId: string, status: string) {
    const previous = jobs.find((j) => j.id === jobId)?.status
    if (!previous || previous === status) return
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
      // Fehlklicks passieren an vier nebeneinanderstehenden Buttons — jeder
      // Wechsel bekommt einen Rückgängig-Weg, bevor er Realität wird
      toast.success(`Status geändert zu ‚${STATUS_LABELS[status] ?? status}‘`, {
        duration: 7000,
        action: {
          label: 'Rückgängig',
          onClick: () =>
            void revertStatus(jobId, previous, previous !== 'REJECTED' && status === 'REJECTED'),
        },
      })
    } catch {
      toast.error('Status konnte nicht aktualisiert werden')
    }
  }

  // Derselbe Endpunkt wie der Wechsel selbst, nur mit dem vorherigen Status;
  // undoRejectedAt verspricht dem Server, dass genau der rückerstattete Klick
  // rejectedAt gesetzt hat (dann darf das Datum zurück auf null)
  async function revertStatus(jobId: string, previous: string, undoRejectedAt: boolean) {
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: previous, ...(undoRejectedAt ? { undoRejectedAt: true } : {}) }),
      })
      if (!response.ok) {
        toast.error('Rückgängigmachen fehlgeschlagen — der Status bleibt wie er ist.')
        return
      }
      fetchJobs()
    } catch {
      toast.error('Rückgängigmachen fehlgeschlagen — der Status bleibt wie er ist.')
    }
  }

  async function bulkSetStatus(status: string) {
    if (selectedIds.size === 0 || bulkBusy) return
    setBulkBusy(true)
    // Vorherige Status je Job merken — die Sammel-Rückgängig-Aktion setzt
    // jeden Einzelnen zurück auf seinen eigenen Ausgangswert
    const previousById = new Map(
      jobs.filter((j) => selectedIds.has(j.id)).map((j) => [j.id, j.status])
    )
    const count = selectedIds.size
    try {
      await Promise.all(
        [...selectedIds].map((id) =>
          fetch(`/api/jobs/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          })
        )
      )
      setSelectedIds(new Set())
      fetchJobs()
      toast.success(`Status geändert zu ‚${STATUS_LABELS[status] ?? status}‘ — ${count} Jobs`, {
        duration: 7000,
        action: {
          label: 'Rückgängig',
          onClick: () => void revertBulk(previousById),
        },
      })
    } catch {
      toast.error('Sammelaktion fehlgeschlagen — bitte erneut versuchen.')
    } finally {
      setBulkBusy(false)
    }
  }

  async function revertBulk(previousById: Map<string, string>) {
    try {
      await Promise.all(
        [...previousById].map(([id, previous]) =>
          fetch(`/api/jobs/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            // undoRejectedAt ist serverseitig abgesichert: gelöscht wird nur,
            // was dieser Klick selbst gesetzt hat
            body: JSON.stringify({ status: previous, undoRejectedAt: true }),
          })
        )
      )
      fetchJobs()
    } catch {
      toast.error('Rückgängigmachen fehlgeschlagen — die Status bleiben wie sie sind.')
    }
  }

  // Der globale Bewertungsrückstand — unabhängig von Filtern, denn der Server
  // bewertet ebenfalls den globalen Rückstand (dasselbe Zählprinzip wie die
  // score-batch-Route: score null und weder archiviert noch abgelehnt)
  const unscoredTotal = useMemo(() => jobs.filter(isBacklogJob).length, [jobs])

  const filteredJobs = useMemo(() => {
    let result = jobs.filter((job) => activeStatuses.has(job.status))

    if (scoreFilter === 'top') {
      result = result.filter((job) => (job.score ?? 0) >= HIGH_MATCH_THRESHOLD)
    } else if (scoreFilter === 'unscored') {
      // „Rückstand" zählt wie überall: score null und weder archiviert noch abgelehnt
      result = result.filter(isBacklogJob)
    } else if (scoreFilter === 'scored') {
      result = result.filter((job) => job.score != null)
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
      case 'oldest':
        result = [...result].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
        break
      default:
        result = [...result].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
    }

    return result
  }, [jobs, activeStatuses, scoreFilter, search, sortBy])

  // Tastatur-Beschleuniger: S in die Suche, J/K den Listenfokus bewegen,
  // Enter öffnet den markierten Job. Nie in Eingabefeldern abfangen.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }
      if (filteredJobs.length === 0) return
      if (e.key === 'j' || e.key === 'J' || e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        const index = filteredJobs.findIndex((job) => job.id === highlightId)
        const next =
          e.key === 'j' || e.key === 'J'
            ? Math.min(index + 1, filteredJobs.length - 1)
            : Math.max(index < 0 ? 0 : index - 1, 0)
        const job = filteredJobs[next]
        setHighlightId(job.id)
        document.getElementById(`job-${job.id}`)?.scrollIntoView({ block: 'nearest' })
        return
      }
      if (e.key === 'Enter' && highlightId) {
        const job = filteredJobs.find((j) => j.id === highlightId)
        if (job) router.push(`/jobs/${job.id}`)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filteredJobs, highlightId, router])

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
    setScoreFilter('all')
    setSortBy('newest')
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function runScoreBatch() {
    setBatchRunning(true)
    setBatchDone(0)
    setBatchTotal(unscoredTotal)
    setBatchRemaining(null)
    batchAbortRef.current = false
    try {
      // 20 Läufe à max. 20 Jobs decken jeden Freundeskreis-Rückstand ab; Abbruch,
      // wenn nichts mehr unbewertet ist oder ein Lauf nichts schafft (nur Skipped)
      for (let run = 0; run < 20; run++) {
        if (batchAbortRef.current) break
        const response = await fetch('/api/jobs/score-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: 20 }),
        })
        const data = (await response.json().catch(() => undefined)) as
          | { scored: number; failed: number; skipped: number; remaining: number; error?: string }
          | undefined
        if (!response.ok || !data) {
          toast.error(data?.error ?? 'Bewertung fehlgeschlagen.')
          return
        }
        setBatchDone((done) => done + data.scored + data.failed + data.skipped)
        setBatchRemaining(data.remaining)
        if (data.remaining === 0 || (data.scored === 0 && data.failed === 0)) break
      }
    } catch {
      toast.error('Bewertung fehlgeschlagen.')
    } finally {
      setBatchRunning(false)
      fetchJobs()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="max-w-5xl mx-auto px-6 py-16">
          <section className="flex items-center justify-between mb-8 animate-pulse motion-reduce:animate-none">
            <div>
              <div className="h-8 w-32 bg-border rounded mb-2" />
              <div className="h-4 w-24 bg-border-soft rounded" />
            </div>
            <div className="h-12 w-40 bg-border-soft rounded-xl" />
          </section>
          <section className="space-y-4 animate-pulse motion-reduce:animate-none">
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
    scoreFilter !== 'all' ||
    activeStatuses.size !== defaultActive.size ||
    [...activeStatuses].some((s) => !defaultActive.has(s))
  const moreActiveCount = [...activeStatuses].filter((s) => !(CORE_STATUSES as readonly string[]).includes(s)).length
  const moreOpen = showMoreStatuses || moreActiveCount > 0

  function statusChip(status: string) {
    const active = activeStatuses.has(status)
    return (
      <button
        key={status}
        onClick={() => toggleStatus(status)}
        aria-pressed={active}
        className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border ${
          active
            ? 'bg-selection text-on-selection border-selection'
            : 'bg-border-soft text-primary-soft border-border'
        }`}
      >
        {STATUS_LABELS[status]}
      </button>
    )
  }

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
            <span aria-hidden="true">+</span> Job hinzufügen
          </ButtonLink>
        </section>

        {jobs.length === 0 ? (
          loadError ? (
            /* Fehler beim Laden — nicht als „0 Jobs" maskieren */
            <section role="alert" className="bg-surface rounded-2xl p-16 text-center border border-border">
              <p className="text-primary-soft mb-6">
                Jobs konnten nicht geladen werden — prüfe deine Verbindung und versuch es erneut.
              </p>
              <Button size="sm" variant="secondary" onClick={() => void fetchJobs()}>
                Erneut laden
              </Button>
            </section>
          ) : (
          /* Empty State — no jobs at all */
          <section className="bg-surface rounded-2xl p-16 text-center border border-border">
            <p className="text-primary-soft mb-6">
              Noch keine Jobs gespeichert.
            </p>
            <ButtonLink href="/jobs/new">
              Ersten Job hinzufügen
            </ButtonLink>
          </section>
          )
        ) : (
          <>
            {/* Filter Toolbar */}
            <section className="bg-surface rounded-2xl p-6 border border-border mb-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Titel oder Firma suchen… (Taste S)"
                  aria-label="Jobs durchsuchen"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-background border border-border text-foreground placeholder:text-primary-soft"
                />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  aria-label="Sortierung"
                  className="px-4 py-2.5 rounded-xl bg-background border border-border text-foreground"
                >
                  <option value="newest">Neueste zuerst</option>
                  <option value="oldest">Älteste zuerst</option>
                  <option value="score">Score absteigend</option>
                  <option value="company">Firma A–Z</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {CORE_STATUSES.map(statusChip)}
                <button
                  onClick={() => setShowMoreStatuses((prev) => !prev)}
                  aria-expanded={moreOpen}
                  className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors border border-dashed border-border text-primary-soft hover:text-foreground hover:border-primary-soft"
                >
                  Weitere Status{moreActiveCount > 0 ? ` (${moreActiveCount} aktiv)` : ''} {moreOpen ? '▾' : '▸'}
                </button>
              </div>
              {moreOpen && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {MORE_STATUSES.map(statusChip)}
                </div>
              )}

              {/* Eine Zeile, ein Entscheidungspunkt: Vier-Wege-Segment trägt
                  „Top Matches" UND den Bewertungsstand — Zustand in Tinten-Blau */}
              <div
                role="group"
                aria-label="Bewertungsstand"
                className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-border bg-background p-1"
              >
                {(
                  [
                    ['all', 'Alle'],
                    ['top', 'Top Matches'],
                    ['scored', 'Bewertet'],
                    ['unscored', 'Rückstand'],
                  ] as const
                ).map(([value, label]) => {
                  const active = scoreFilter === value
                  return (
                    <button
                      key={value}
                      onClick={() => setScoreFilter(value)}
                      aria-pressed={active}
                      className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        active
                          ? 'bg-selection text-on-selection'
                          : 'text-primary-soft hover:text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              {/* Der Rückstand hat zwei Gesichter: in der Unbewertet-Ansicht die
                  Abtretung mit Erklärlink, aus jeder anderen Ansicht der sichtbare
                  Einstieg — beides derselbe globale Zähler */}
              {scoreFilter === 'unscored' ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-primary-soft">
                    Scores entstehen bei der Suche (bis zu {SCORE_LIMIT} pro Lauf) — der Rest
                    wartet hier.{' '}
                    <Link href="/so-funktionierts#score-limit" className="text-selection hover:text-selection-strong">
                      Warum gibt es Reste?
                    </Link>
                  </p>
                  {unscoredTotal > 0 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        if (batchRunning) {
                          batchAbortRef.current = true
                        } else {
                          void runScoreBatch()
                        }
                      }}
                    >
                      {batchRunning
                        ? `Stoppen (${batchDone}/${batchTotal})`
                        : `Rückstand bewerten (${unscoredTotal})`}
                    </Button>
                  )}
                </div>
              ) : (
                unscoredTotal > 0 && !batchRunning && (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-primary-soft tabular-nums">
                      {unscoredTotal} {unscoredTotal === 1 ? 'Job wartet' : 'Jobs warten'} auf die Bewertung.
                    </p>
                    <Button size="sm" variant="secondary" onClick={() => void runScoreBatch()}>
                      Rückstand bewerten
                    </Button>
                  </div>
                )
              )}
              {batchRunning && scoreFilter !== 'unscored' && (
                <p className="text-xs text-primary-soft tabular-nums">
                  Bewerte … {batchDone}/{batchTotal}
                </p>
              )}
              {/* Hartgrenze erreicht oder manuell gestoppt: der Rest wird
                  benannt statt still abzubrechen — ein Klick startet die nächste Etappe */}
              {!batchRunning && batchRemaining != null && batchRemaining > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xs text-primary-soft tabular-nums">
                    Noch {batchRemaining} unbewertet — erneut starten für den Rest.
                  </p>
                  <button
                    onClick={() => void runScoreBatch()}
                    className="text-sm text-primary hover:text-selection transition-colors"
                  >
                    Erneut starten
                  </button>
                </div>
              )}
            </section>

            {/* Result Counter */}
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 mb-4">
              <p className="text-sm text-primary-soft tabular-nums">
                {filteredJobs.length} von {jobs.length} Jobs
              </p>
              <div className="flex items-center gap-4">
                <p className="text-xs text-primary-soft hidden sm:block">
                  Tastatur: S = Suche · J/K = vor/zurück · Enter = öffnen
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="text-sm text-primary hover:text-selection transition-colors"
                  >
                    Filter zurücksetzen
                  </button>
                )}
              </div>
            </div>

            {/* Sammelaktionsleiste — erscheint nur bei Auswahl, verdrängt nichts */}
            {selectedIds.size > 0 && (
              <div className="flex flex-wrap items-center gap-3 mb-4 bg-surface rounded-2xl p-4 border border-selection">
                <p className="text-sm font-medium text-foreground tabular-nums">
                  {selectedIds.size} {selectedIds.size === 1 ? 'Job' : 'Jobs'} ausgewählt
                </p>
                <div className="flex flex-wrap gap-2">
                  <StatusButton label="Beworben" onClick={() => void bulkSetStatus('APPLIED')} active={false} />
                  <StatusButton label={STATUS_LABELS.INTERVIEW} onClick={() => void bulkSetStatus('INTERVIEW')} active={false} />
                  <StatusButton label="Archiv" onClick={() => void bulkSetStatus('ARCHIVED')} active={false} />
                </div>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  disabled={bulkBusy}
                  className="text-sm text-primary hover:text-selection transition-colors disabled:opacity-50"
                >
                  Abwählen
                </button>
              </div>
            )}

            {filteredJobs.length === 0 ? (
              /* Empty State — filters yield nothing */
              <section className="bg-surface rounded-2xl p-16 text-center border border-border">
                <p className="text-primary-soft mb-6">
                  Keine Jobs für diese Filter.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button onClick={resetFilters}>
                    Filter zurücksetzen
                  </Button>
                  <ButtonLink href="/search" variant="secondary">
                    Neue Suche starten
                  </ButtonLink>
                </div>
              </section>
            ) : (
              /* Job List */
              <section className="space-y-4">
                {filteredJobs.map((job) => (
                  <div
                    key={job.id}
                    id={`job-${job.id}`}
                    className={`bg-surface rounded-2xl p-8 border shadow-sm ${
                      highlightId === job.id ? 'border-selection' : 'border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-5 gap-4">
                      <div className="min-w-0 flex-1 flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(job.id)}
                          onChange={() => toggleSelected(job.id)}
                          aria-label={`Job „${job.title}“ auswählen`}
                          className="mt-1.5 w-4 h-4 accent-selection flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <Link href={`/jobs/${job.id}`}>
                            <h2 className="text-xl font-medium text-foreground hover:text-selection transition-colors mb-1">
                              {job.title}
                            </h2>
                          </Link>
                          <p className="text-primary-soft">
                            {[
                              job.company ?? null,
                              job.location ?? null,
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'Ohne Angabe'}
                          </p>
                        </div>
                      </div>
                      {job.score != null ? (
                        <ScoreBadge score={job.score} size="lg" />
                      ) : (
                        <div className="text-xs text-primary-soft pt-3">
                          Noch keine Bewertung
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
                          className="text-sm text-primary hover:text-selection transition-colors"
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
                          label={STATUS_LABELS.INTERVIEW}
                          onClick={() => updateStatus(job.id, 'INTERVIEW')}
                          active={job.status === 'INTERVIEW'}
                        />
                        <StatusButton
                          label="Abgelehnt"
                          onClick={() => updateStatus(job.id, 'REJECTED')}
                          active={job.status === 'REJECTED'}
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
