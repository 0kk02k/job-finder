'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '../components/Toast'
import { Button, ButtonLink, StatusBadge, StatusButton, HIGH_MATCH_THRESHOLD, scoreTone } from '../components/ui'
import { scoreLabel } from '@/lib/matching'
import { STATUS_LABELS } from '@/lib/status'
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

  async function bulkSetStatus(status: string) {
    if (selectedIds.size === 0 || bulkBusy) return
    setBulkBusy(true)
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
    } catch {
      toast.error('Sammelaktion fehlgeschlagen — bitte erneut versuchen.')
    } finally {
      setBulkBusy(false)
    }
  }

  // Der globale Bewertungsrückstand — unabhängig von Filtern, denn der Server
  // bewertet ebenfalls den globalen Rückstand
  const unscoredTotal = useMemo(() => jobs.filter((job) => job.score == null).length, [jobs])

  const filteredJobs = useMemo(() => {
    let result = jobs.filter((job) => activeStatuses.has(job.status))

    if (scoreFilter === 'top') {
      result = result.filter((job) => (job.score ?? 0) >= HIGH_MATCH_THRESHOLD)
    } else if (scoreFilter === 'unscored') {
      result = result.filter((job) => job.score == null)
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
    try {
      // 20 Läufe à max. 20 Jobs decken jeden Freundeskreis-Rückstand ab; Abbruch,
      // wenn nichts mehr unbewertet ist oder ein Lauf nichts schafft (nur Skipped)
      for (let run = 0; run < 20; run++) {
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
        if (data.remaining === 0 || (data.scored === 0 && data.failed === 0)) break
      }
    } catch {
      toast.error('Bewertung fehlgeschlagen.')
    } finally {
      setBatchRunning(false)
      fetchJobs()
    }
  }

  const getScoreColor = scoreTone

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
                    ['unscored', 'Unbewertet'],
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
                    <Link href="/so-funktionierts" className="text-selection hover:text-selection-strong">
                      Warum gibt es Reste?
                    </Link>
                  </p>
                  {unscoredTotal > 0 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void runScoreBatch()}
                      disabled={batchRunning}
                    >
                      {batchRunning
                        ? `Bewerte … ${batchDone}/${batchTotal}`
                        : `Unbewertete bewerten (${unscoredTotal})`}
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
                  <StatusButton label="Gespräch" onClick={() => void bulkSetStatus('INTERVIEW')} active={false} />
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
                  <button
                    onClick={resetFilters}
                    className="inline-flex items-center justify-center px-6 py-3 bg-accent hover:bg-accent-strong text-on-accent rounded-xl font-medium transition-colors"
                  >
                    Filter zurücksetzen
                  </button>
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
                        <div className={`text-3xl font-light tabular-nums ${getScoreColor(job.score)}`}>
                          <span className="sr-only">
                            KI-Score: {job.score} von 10 — {scoreLabel(job.score)}
                          </span>
                          <span aria-hidden="true">{job.score}</span>
                        </div>
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
                          label="Gespräch"
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
