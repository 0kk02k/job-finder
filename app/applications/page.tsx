'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '../components/Toast'
import { Button, StatusBadge, scoreTone } from '../components/ui'
import { collectFollowUps, isDue } from '@/lib/applications'

interface Application {
  id: string
  title: string
  company: string | null
  location: string | null
  url: string
  status: string
  score: number | null
  createdAt: string
  appliedAt: string | null
  followUpAt: string | null
  notes: string | null
}

interface WeekStats {
  appliedThisWeek: number
  rejectedThisWeek: number
  interviews: number
  offers: number
}

// „12.08." — mit Jahr, wenn der Fund nicht aus diesem Jahr stammt.
// Absolute Daten: im Cockpit sind sie Messwerte, keine Stimmung.
function shortDate(iso: string): string {
  const date = new Date(iso)
  const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' }
  if (date.getFullYear() !== new Date().getFullYear()) options.year = 'numeric'
  return date.toLocaleDateString('de-DE', options)
}

// Eine Zeile, ein Zustand: Notiz und Wiedervorlage gehören der Zeile, Fehler
// ändern sie nicht — der Text bleibt stehen, der Toast benennt den Grund.
// Bewusst außerhalb der Seite definiert: eine in render gebaute Komponente
// würde bei jedem Parent-Render remounten und Fokus sowie Eingaben verlieren.
function ApplicationCard({
  application,
  onUpdated,
}: {
  application: Application
  onUpdated: (changes: Partial<Application>) => void
}) {
  const toast = useToast()
  const [notes, setNotes] = useState(application.notes ?? '')
  const [followUp, setFollowUp] = useState(
    application.followUpAt ? application.followUpAt.slice(0, 10) : ''
  )
  const due = application.followUpAt != null && isDue(application.followUpAt, new Date())

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    const response = await fetch(`/api/jobs/${application.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      toast.error('Speichern fehlgeschlagen — der Eintrag bleibt unverändert.')
      return false
    }
    return true
  }

  async function saveNotes() {
    if (notes === (application.notes ?? '')) return
    const next = notes === '' ? null : notes
    if (await patch({ notes })) onUpdated({ notes: next })
  }

  async function saveFollowUp(value: string) {
    if (await patch({ followUpAt: value === '' ? null : value })) {
      onUpdated({ followUpAt: value === '' ? null : value })
    }
  }

  return (
    <div className="bg-surface rounded-2xl p-6 border border-border">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <Link href={`/jobs/${application.id}`}>
            <h2 className="text-lg font-medium text-foreground hover:text-selection transition-colors">
              {application.title}
            </h2>
          </Link>
          <p className="text-sm text-primary-soft">
            {[application.company, application.location].filter(Boolean).join(' · ') || 'Ohne Angabe'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {application.score != null && (
            <span
              className={`text-xl font-light tabular-nums ${scoreTone(application.score)}`}
              title={`KI-Score ${application.score} von 10`}
            >
              <span className="sr-only">KI-Score: {application.score} von 10</span>
              <span aria-hidden="true">{application.score}</span>
            </span>
          )}
          <StatusBadge status={application.status} />
        </div>
      </div>

      {/* Die Zeitstempel, um die es geht: gefunden, beworben — und der eigene Termin */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-primary tabular-nums mb-4">
        <span>Gefunden am {shortDate(application.createdAt)}</span>
        {application.appliedAt && <span>Beworben am {shortDate(application.appliedAt)}</span>}
        <label className="flex items-center gap-2">
          <span className="text-primary-soft">Wiedervorlage</span>
          <input
            type="date"
            value={followUp}
            onChange={(e) => {
              setFollowUp(e.target.value)
              void saveFollowUp(e.target.value)
            }}
            aria-label={`Wiedervorlage für ${application.title}`}
            className="px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground text-sm"
          />
        </label>
        {due && (
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning border border-warning/20">
            Fällig
          </span>
        )}
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => void saveNotes()}
        rows={2}
        placeholder="Notiz — Gesprächsverlauf, Ansprechpartner, nächster Schritt …"
        aria-label={`Notiz zu ${application.title}`}
        className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-primary-soft text-sm leading-relaxed resize-y"
      />
    </div>
  )
}

export default function ApplicationsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [applications, setApplications] = useState<Application[]>([])
  const [stats, setStats] = useState<WeekStats | null>(null)

  useEffect(() => {
    loadApplications()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Initial-Load, Muster der Jobs-Seite
  }, [])

  async function loadApplications() {
    setLoading(true)
    setError(false)
    try {
      const response = await fetch('/api/applications')
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        setError(true)
        return
      }
      const data = await response.json()
      setApplications(Array.isArray(data.applications) ? data.applications : [])
      setStats(data.stats ?? null)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  // Der Termin-Überblick leitet sich aus demselben State ab wie die Karten —
  // eine geänderte Wiedervorlage aktualisiert ihn sofort mit.
  const now = new Date()
  const followUps = collectFollowUps(applications)

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="max-w-5xl mx-auto px-6 py-16">
          <div className="animate-pulse motion-reduce:animate-none" aria-hidden="true">
            <div className="h-9 w-44 bg-border rounded mb-3" />
            <div className="h-4 w-72 bg-border-soft rounded mb-8" />
            <div className="space-y-4">
              <div className="h-40 bg-surface border border-border-soft rounded-2xl" />
              <div className="h-40 bg-surface border border-border-soft rounded-2xl" />
            </div>
          </div>
          <p className="sr-only" role="status">
            Bewerbungen werden geladen …
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-5xl mx-auto px-6 py-16">
        <section className="mb-8">
          <h1 className="text-3xl font-light text-foreground mb-3">Bewerbungen</h1>
          {stats && (
            <p className="text-sm text-primary tabular-nums">
              Diese Woche: {stats.appliedThisWeek}{' '}
              {stats.appliedThisWeek === 1 ? 'Bewerbung' : 'Bewerbungen'}
              {' · '}
              {stats.interviews} im Gespräch
              {' · '}
              {stats.offers} {stats.offers === 1 ? 'Angebot' : 'Angebote'}
              {stats.rejectedThisWeek > 0 && (
                <>
                  {' · '}
                  {stats.rejectedThisWeek} {stats.rejectedThisWeek === 1 ? 'Absage' : 'Absagen'}
                </>
              )}
            </p>
          )}
        </section>

        {error && (
          <section
            role="alert"
            className="mb-8 p-4 bg-error/10 rounded-xl border border-error/20 flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm text-primary">Bewerbungen konnten nicht geladen werden.</p>
            <Button size="sm" variant="secondary" onClick={() => void loadApplications()}>
              Erneut versuchen
            </Button>
          </section>
        )}

        {/* Termin-Überblick: alle gesetzten Wiedervorlagen auf einem Blick,
            aufsteigend — Überfälliges steht automatisch oben */}
        {!error && followUps.length > 0 && (
          <section
            aria-label="Wiedervorlagen"
            className="mb-8 bg-surface rounded-2xl px-6 py-5 border border-border"
          >
            <h2 className="text-sm font-medium text-primary-soft mb-2">Wiedervorlagen</h2>
            <ul className="divide-y divide-border-soft">
              {followUps.map((f) => (
                <li
                  key={f.id}
                  className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                >
                  <span className="tabular-nums text-foreground font-medium w-14 flex-shrink-0">
                    {shortDate(f.followUpAt)}
                  </span>
                  <Link
                    href={`/jobs/${f.id}`}
                    className="flex-1 min-w-0 truncate text-primary hover:text-selection transition-colors"
                  >
                    {[f.company, f.title].filter(Boolean).join(' · ')}
                  </Link>
                  <StatusBadge status={f.status} />
                  {isDue(f.followUpAt, now) && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning border border-warning/20">
                      Fällig
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {!error && applications.length === 0 ? (
          <section className="bg-surface rounded-2xl p-16 text-center border border-border">
            <p className="text-primary-soft mb-6">
              Noch nichts beworben. Deine stärksten Treffer warten schon.
            </p>
            <Link
              href="/jobs?filter=high_match"
              className="inline-flex items-center justify-center px-6 py-3 bg-accent hover:bg-accent-strong text-on-accent rounded-xl font-medium transition-colors"
            >
              Top Matches ansehen
            </Link>
          </section>
        ) : (
          <section className="space-y-4">
            {applications.map((application) => (
              <ApplicationCard
                key={application.id}
                application={application}
                onUpdated={(changes) =>
                  setApplications((prev) =>
                    prev.map((a) => (a.id === application.id ? { ...a, ...changes } : a))
                  )
                }
              />
            ))}
          </section>
        )}
      </main>
    </div>
  )
}
