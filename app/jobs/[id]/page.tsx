'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '../../components/Toast'
import { MarkdownContent, structureJobDescription } from '../../components/Markdown'
import { Button, StatusBadge, StatusButton, buttonClasses, scoreTone } from '../../components/ui'
import { scoreLabel } from '@/lib/matching'
import { STATUS_LABELS } from '@/lib/status'

interface Job {
  id: string
  title: string
  company: string | null
  location: string | null
  description: string
  url: string
  status: string
  score: number | null
  scoreReason: string | null
  matchDetails: string | null
  appliedAt: string | null
  createdAt: string
}

interface MatchDetails {
  strengths?: string[]
  gaps?: string[]
  transferableSkills?: string[]
}

function parseMatchDetails(raw: string | null): MatchDetails {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as MatchDetails
  } catch {
    return {}
  }
}

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const toast = useToast()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Ein „beschäftigt“-Zustand pro Handlung — ein gemeinsamer sperrt beide Buttons
  // und behauptet, was nicht passiert
  const [busy, setBusy] = useState<'resume' | 'generate' | 'letter' | null>(null)
  // Anschreiben: bewusst nur Client-State — der Text gehört der Nutzerin, sie
  // bearbeitet ihn und lädt das PDF selbst. Nichts wird persistiert.
  const [letter, setLetter] = useState<{ text: string; source: 'ki' | 'vorlage' } | null>(null)
  const [letterError, setLetterError] = useState<string | null>(null)

  async function updateStatus(status: string) {
    if (!job) return
    try {
      const response = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) {
        toast.error('Status konnte nicht aktualisiert werden')
        return
      }
      setJob({ ...job, status })
    } catch {
      toast.error('Status konnte nicht aktualisiert werden')
    }
  }

  // Löschen ist unwiderruflich (Historie kaskadiert mit) — deshalb zweistufig
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  async function handleDelete() {
    if (!job) return
    try {
      const response = await fetch(`/api/jobs/${job.id}`, { method: 'DELETE' })
      if (!response.ok) {
        toast.error('Löschen fehlgeschlagen — die Anzeige bleibt erhalten.')
        return
      }
      toast.success('Anzeige gelöscht.')
      router.push('/jobs')
    } catch {
      toast.error('Löschen fehlgeschlagen — die Anzeige bleibt erhalten.')
    }
  }

  async function fetchJob(jobId: string) {
    try {
      const response = await fetch(`/api/jobs/${jobId}`)
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        setError(response.status === 404 ? 'Job nicht gefunden' : 'Job konnte nicht geladen werden')
        return
      }
      const data = await response.json()
      setJob(data)
    } catch (error) {
      console.error('Failed to fetch job:', error)
      setError('Job konnte nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initialer Daten-Fetch; setState läuft erst nach dem await
    void fetchJob(id)
  }, [id])

  // Anschreiben erzeugen: Primärweg KI (echter Lebenslauf + echte Anzeige). Ein
  // Ausfall wird benannt — der Stufen-2-Fallback (Vorlage) läuft nur auf Ausdruck.
  async function handleGenerateLetter(useTemplate = false) {
    if (!job) return
    setBusy('generate')
    setLetterError(null)
    try {
      if (useTemplate) {
        const response = await fetch('/api/pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'coverletter-template', jobId: job.id }),
        })
        if (!response.ok) {
          setLetterError('Die Vorlage konnte nicht erzeugt werden.')
          return
        }
        const data = await response.json()
        setLetter({ text: data.text, source: 'vorlage' })
        return
      }

      const response = await fetch('/api/coverletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      })
      const data = await response.json().catch(() => undefined)
      if (!response.ok) {
        setLetterError(
          data?.error ??
            'Die KI ist nicht erreichbar — es wurde kein Anschreiben erzeugt. Deine Daten sind unverändert.'
        )
        return
      }
      setLetter({ text: data.text, source: 'ki' })
    } catch {
      setLetterError('Netzwerkfehler — prüfe deine Verbindung und versuch es erneut.')
    } finally {
      setBusy(null)
    }
  }

  async function handleDownloadPDF(type: 'resume' | 'letter', format: 'pdf' | 'docx' = 'pdf') {
    if (!job) return

    setBusy(type)
    try {
      const response = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: type === 'resume' ? 'resume' : 'coverletter',
          // jobId auch beim Lebenslauf: der Download folgt der Sprache der Anzeige
          jobId: job.id,
          format,
          ...(type === 'letter' && letter?.text ? { content: letter.text } : {}),
        }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = type === 'resume' ? `Lebenslauf.${format}` : `Anschreiben_${job.company ?? 'Bewerbung'}.${format}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        toast.error('Das Dokument konnte nicht erzeugt werden — versuch es erneut.')
      }
    } catch {
      toast.error('Netzwerkfehler — das Dokument konnte nicht geladen werden.')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-primary-soft">Lade Job …</p>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-primary-soft mb-4">{error || 'Job nicht gefunden'}</p>
          <button
            onClick={() => router.push('/jobs')}
            className="text-sm text-primary hover:text-selection transition-colors"
          >
            Zurück zur Job-Übersicht
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-5xl mx-auto px-6 py-16">
        <div className="flex items-start justify-between mb-6">
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-4xl font-light text-foreground mb-2">
              {job.title}
            </h1>
            <p className="text-primary">
              {job.company ?? 'Ohne Angabe'}
              {job.location && (
                <span className="text-primary-soft"> · {job.location}</span>
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <StatusBadge status={job.status} />
            {/* Status-Wechsler: dieselben Schnellstufen wie in der Übersicht */}
            <div className="flex flex-wrap justify-end gap-2">
              {['APPLIED', 'INTERVIEW', 'REJECTED', 'ARCHIVED'].map((status) => (
                <StatusButton
                  key={status}
                  label={STATUS_LABELS[status]}
                  onClick={() => void updateStatus(status)}
                  active={job.status === status}
                />
              ))}
            </div>
          </div>
        </div>

        {job.score != null ? (
          <div className="bg-surface rounded-2xl p-6 border border-border mb-6">
            <div className="flex items-baseline gap-3 mb-3">
              <span className={`text-5xl font-light tabular-nums ${scoreTone(job.score)}`}>
                <span className="sr-only">
                  KI-Score: {job.score} von 10 — {scoreLabel(job.score)}
                </span>
                <span aria-hidden="true">
                  {job.score}
                  <span className="text-2xl text-primary-soft">/10</span>
                </span>
              </span>
              <span className="text-sm text-primary-soft">KI-Score</span>
            </div>
            {job.scoreReason && (
              <p className="text-primary leading-relaxed max-w-prose">
                {job.scoreReason}
              </p>
            )}
            {(() => {
              const { strengths, gaps, transferableSkills } = parseMatchDetails(job.matchDetails)
              return (
                <>
                  {strengths && strengths.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-foreground mb-2">Passt gut:</p>
                      <div className="flex flex-wrap gap-2">
                        {strengths.map((skill, i) => (
                          <span key={i} className="px-3 py-1 bg-success/10 text-success text-sm rounded-full">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {gaps && gaps.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-foreground mb-2">Fehlt:</p>
                      <div className="flex flex-wrap gap-2">
                        {gaps.map((gap, i) => (
                          <span key={i} className="px-3 py-1 bg-error/10 text-error text-sm rounded-full">
                            {gap}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {transferableSkills && transferableSkills.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-foreground mb-2">Übertragbare Stärken:</p>
                      <div className="flex flex-wrap gap-2">
                        {transferableSkills.map((skill, i) => (
                          <span key={i} className="px-3 py-1 bg-border-soft text-foreground text-sm rounded-full">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        ) : (
          <div className="bg-surface rounded-2xl p-6 border border-border mb-6">
            <p className="text-sm text-primary">
              Noch keine Bewertung — entsteht bei der nächsten Suche oder beim erneuten Suchen
              dieses Jobs.
            </p>
          </div>
        )}

        <div className="bg-surface rounded-2xl p-6 border border-border mb-6">
          <h2 className="text-sm font-medium text-primary-soft mb-4">
            Beschreibung
          </h2>
          <div className="prose max-w-none">
            {/* Strukturiert (Entities, Bullets, Satz-Absätze, Anzeigen-Überschriften) gerendert —
                keine Formatierungsartefakte und keine Textwände aus den Job-Börsen-Feeds */}
            <MarkdownContent content={structureJobDescription(job.description ?? '')} variant="description" />
          </div>
        </div>

        {/* Anschreiben — das Artefakt, das einen Menschen erreicht: KI-Entwurf aus dem echten
            Lebenslauf, editierbar vor dem Download. Kein stiller Fallback — ein KI-Ausfall
            wird benannt, die Vorlage ist ausdrücklich als solche markiert. */}
        <div className="bg-surface rounded-2xl p-6 border border-border mb-6">
          <h2 className="text-sm font-medium text-primary-soft mb-4">Anschreiben</h2>

          {!letter && !letterError && (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-primary leading-relaxed max-w-prose">
                Aus deinem Lebenslauf und dieser Stellenanzeige — zum Bearbeiten, bevor du sie
                verschickst.
              </p>
              <Button onClick={() => void handleGenerateLetter(false)} disabled={busy !== null}>
                {busy === 'generate' ? 'Wird erzeugt …' : 'Anschreiben erzeugen'}
              </Button>
            </div>
          )}

          {letterError && (
            <div className="mb-4">
              <div role="alert" className="p-4 bg-error/10 rounded-xl border border-error/20 mb-4">
                <p className="text-sm text-primary">{letterError}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button size="sm" variant="secondary" onClick={() => void handleGenerateLetter(false)}>
                  Erneut versuchen
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void handleGenerateLetter(true)}>
                  Statische Vorlage verwenden
                </Button>
              </div>
            </div>
          )}

          {letter && (
            <div>
              <p className="text-xs text-primary-soft mb-2">
                {letter.source === 'ki'
                  ? 'Von der KI aus deinem Lebenslauf erzeugt — bitte persönlich prüfen und anpassen.'
                  : 'Statische Vorlage — bitte in eigenen Worten prüfen, bevor du sie verschickst.'}
              </p>
              <label htmlFor="coverletter-text" className="sr-only">
                Anschreiben-Text (bearbeitbar)
              </label>
              <textarea
                id="coverletter-text"
                value={letter.text}
                onChange={(e) => setLetter({ ...letter, text: e.target.value })}
                rows={14}
                className="w-full rounded-xl bg-background border border-border p-4 text-sm leading-relaxed text-foreground"
              />
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <Button size="sm" onClick={() => void handleDownloadPDF('letter', 'pdf')} disabled={busy !== null}>
                  {busy === 'letter' ? 'Wird geladen …' : 'Als PDF'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void handleDownloadPDF('letter', 'docx')} disabled={busy !== null}>
                  {busy === 'letter' ? 'Wird geladen …' : 'Als DOCX'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void handleGenerateLetter(letter.source === 'vorlage')}
                  disabled={busy !== null}
                >
                  Neu erzeugen
                </Button>
                <button
                  onClick={() => setLetter(null)}
                  className="text-sm text-primary underline decoration-selection/60 underline-offset-4 hover:text-foreground hover:decoration-selection"
                >
                  Verwerfen
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-surface rounded-2xl p-6 border border-border mb-6">
          <h2 className="text-sm font-medium text-primary-soft mb-4">
            Unterlagen & Quelle
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-3">
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => void handleDownloadPDF('resume', 'pdf')}
                disabled={busy !== null}
              >
                {busy === 'resume' ? 'Wird geladen …' : 'Lebenslauf als PDF'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => void handleDownloadPDF('resume', 'docx')}
                disabled={busy !== null}
              >
                {busy === 'resume' ? 'Wird geladen …' : 'Lebenslauf als DOCX'}
              </Button>
            </div>
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses('secondary', 'sm') + ' w-full'}
            >
              Anzeige im Portal ansehen
            </a>
          </div>

          {/* Löschen — zweistufig bestätigt, weil auch die Status-Historie verschwindet */}
          <div className="mt-5 pt-4 border-t border-border flex justify-end">
            {confirmingDelete ? (
              <div className="flex flex-wrap items-center justify-end gap-3">
                <span className="text-sm text-primary">
                  Anzeige wirklich löschen? Auch die Status-Historie verschwindet.
                </span>
                <button
                  onClick={() => void handleDelete()}
                  className="text-sm font-medium text-error underline decoration-error/60 underline-offset-4 hover:decoration-error"
                >
                  Ja, löschen
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="text-sm text-primary underline decoration-border underline-offset-4 hover:text-foreground"
                >
                  Abbrechen
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="text-sm text-error hover:underline underline-offset-4"
              >
                Anzeige löschen
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
