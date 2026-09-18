'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '../../components/Toast'
import { MarkdownContent, structureJobDescription } from '../../components/Markdown'
import { Button, StatusBadge, StatusButton, buttonClasses, ScoreBadge } from '../../components/ui'
import { STATUS_LABELS } from '@/lib/status'
import { isDue } from '@/lib/applications'
import { SCORE_LIMIT } from '@/lib/search'

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
  followUpAt: string | null
  notes: string | null
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

// Chooser-Typen — spiegelbildlich zu den Responses der Anecdotes-API
interface NeedGuessClient {
  quote: string
  need: string
  why: string
}

interface AnecdoteMatchClient {
  anecdoteId: string
  reason: string
  addresses: number[]
}

interface AnecdoteClient {
  id: string
  title: string
  situation: string
  action: string
  result: string
  skills: string
  source: string
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
  const [busy, setBusy] = useState<'resume' | 'generate' | 'letter' | 'score' | null>(null)
  // Anschreiben: bewusst nur Client-State — der Text gehört der Nutzerin, sie
  // bearbeitet ihn und lädt das PDF selbst. Nichts wird persistiert.
  const [letter, setLetter] = useState<{ text: string; source: 'ki' | 'vorlage' } | null>(null)
  const [letterError, setLetterError] = useState<string | null>(null)
  // Anekdoten-Chooser: die Wahl VOR der Generierung (Spec: „Nutzer wählt vorab").
  // `ranked: false` heißt, der Match-Aufruf ist fehlgeschlagen — die Sammlung
  // erscheint unrangiert zum Selbstwählen, beschriftet als Ausnahme.
  const [chooser, setChooser] = useState<{
    needs: NeedGuessClient[]
    matches: AnecdoteMatchClient[]
    anecdotes: AnecdoteClient[]
    ranked: boolean
  } | null>(null)
  const [chosenAnecdote, setChosenAnecdote] = useState<string>('none')
  const [matching, setMatching] = useState(false)
  const [anecdoteHint, setAnecdoteHint] = useState(false)
  // Notiz & Wiedervorlage — dieselben Felder wie im Cockpit, derselbe Schreibweg (PATCH).
  // Sync beim Job-Wechsel als Render-Zeit-Muster: Status-Buttons (eigene setJob-Aufrufe)
  // dürfen laufende Eingaben nicht wegwalzen, nur echter Job-Wechsel setzt zurück.
  const [loadedJobId, setLoadedJobId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [followUp, setFollowUp] = useState('')
  // Rückstand für den Weiter-Hinweis nach einer Absage — ein einziger Zähler,
  // der dem emotionalen Tief einen Ausweg anbietet
  const [unscoredCount, setUnscoredCount] = useState(0)

  useEffect(() => {
    fetch('/api/jobs')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Array<{ score: number | null }>) =>
        setUnscoredCount(data.filter((j) => j.score == null).length)
      )
      .catch(() => {})
  }, [])
  if (job && job.id !== loadedJobId) {
    setLoadedJobId(job.id)
    setNotes(job.notes ?? '')
    setFollowUp(job.followUpAt ? job.followUpAt.slice(0, 10) : '')
  }

  // Rangierte zuerst (in Reihenfolge der Rangliste, mit Begründung), dann der
  // Rest der Sammlung — die Wahl bleibt immer vollständig wählbar.
  const orderedChoices = chooser
    ? [
        ...chooser.matches
          .map((m) => ({
            anecdote: chooser.anecdotes.find((a) => a.id === m.anecdoteId),
            reason: m.reason as string | undefined,
          }))
          .filter((entry): entry is { anecdote: AnecdoteClient; reason: string } => entry.anecdote !== undefined),
        ...chooser.anecdotes
          .filter((a) => !chooser.matches.some((m) => m.anecdoteId === a.id))
          .map((a) => ({ anecdote: a, reason: undefined as string | undefined })),
      ]
    : []

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

  // Scoring auf Abruf: der Job muss nicht mehr auf die nächste Suche warten.
  // Fehler ehrlich benannt — ohne erreichbare KI bleibt der Score offen.
  async function scoreNow() {
    if (!job || busy) return
    setBusy('score')
    try {
      const response = await fetch(`/api/jobs/${job.id}/score`, { method: 'POST' })
      if (!response.ok) {
        const data = (await response.json().catch(() => undefined)) as { error?: string } | undefined
        toast.error(data?.error ?? 'Bewertung fehlgeschlagen — der Score bleibt offen.')
        return
      }
      setJob(await response.json())
    } catch {
      toast.error('Bewertung fehlgeschlagen — der Score bleibt offen.')
    } finally {
      setBusy(null)
    }
  }

  // Speicher-Signal für die Blur-Felder: nach erfolgreichem Patch steht
  // „Gespeichert um HH:MM" am Feld; beim nächsten Tastenschlag verschwindet
  // es wieder — ein stilles onBlur bekommt einen sichtbaren Abschluss
  const [savedAt, setSavedAt] = useState<string | null>(null)
  function markSaved() {
    setSavedAt(
      new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    )
  }

  async function saveCockpitField(body: Record<string, unknown>) {
    if (!job) return false
    const response = await fetch(`/api/jobs/${job.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      toast.error('Speichern fehlgeschlagen — der Eintrag bleibt unverändert.')
      setSavedAt(null)
      return false
    }
    markSaved()
    return true
  }

  async function saveNotes() {
    if (!job || notes === (job.notes ?? '')) return
    const next = notes === '' ? null : notes
    if (await saveCockpitField({ notes })) setJob({ ...job, notes: next })
  }

  async function saveFollowUp(value: string) {
    if (!job) return
    if (await saveCockpitField({ followUpAt: value === '' ? null : value })) {
      setJob({ ...job, followUpAt: value === '' ? null : value })
    }
  }

  // Anschreiben verwerfen ist destruktiv (der bearbeitete Text ist weg) —
  // zweistufig wie die anderen Destruktiven: erster Klick fragt, der zweite führt aus
  const [confirmingDiscardLetter, setConfirmingDiscardLetter] = useState(false)

  // Anecdote-Chooser: die drei besten Passungen liegen offen, der Rest hinter
  // einer Disclosure — die ganze Sammlung als Radio-Liste überfordert den
  // Entscheidungspunkt (Muster: „Weitere Status" auf /jobs)
  const [showAllAnecdotes, setShowAllAnecdotes] = useState(false)

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
  async function handleGenerateLetter(
    useTemplate = false,
    anecdote?: { anecdoteId: string; need?: NeedGuessClient }
  ) {
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
        body: JSON.stringify({
          jobId: job.id,
          ...(anecdote ? { anecdoteId: anecdote.anecdoteId, need: anecdote.need } : {}),
        }),
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

  // Der Weg zum Anschreiben läuft über die Wahl: erst prüfen, ob es Anekdoten
  // gibt (leerer Bestand → Generierung wie bisher plus ein Angebot, kein
  // Vorwurf), dann das zweistufige Lesen der Anzeige. KI-Ausfall beim Matchen
  // ist keine Sperre — die Sammlung erscheint unrangiert zum Selbstwählen.
  async function startLetterGeneration() {
    if (!job || busy || matching) return
    setAnecdoteHint(false)
    // Fehlerblock weichen — sonst könnte der Chooser dahinter unsichtbar bleiben
    setLetterError(null)
    setMatching(true)
    try {
      const listResponse = await fetch('/api/anecdotes')
      if (!listResponse.ok) {
        await handleGenerateLetter(false)
        return
      }
      const anecdotes: AnecdoteClient[] = await listResponse.json()
      if (!Array.isArray(anecdotes) || anecdotes.length === 0) {
        setAnecdoteHint(true)
        await handleGenerateLetter(false)
        return
      }
      const response = await fetch('/api/anecdotes/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      })
      if (response.ok) {
        const data = await response.json()
        const needs: NeedGuessClient[] = Array.isArray(data.needs) ? data.needs : []
        const matches: AnecdoteMatchClient[] = Array.isArray(data.matches) ? data.matches : []
        // Altes Anschreiben weicht — sonst bliebe der Chooser hinter dem Brief unsichtbar
        setLetter(null)
        setChooser({ needs, matches, anecdotes, ranked: true })
        // Beste Vorgabe (Spec): der erste Rang ist vorab gewählt
        setChosenAnecdote(matches[0]?.anecdoteId ?? 'none')
      } else {
        setLetter(null)
        setChooser({ needs: [], matches: [], anecdotes, ranked: false })
        setChosenAnecdote('none')
      }
    } catch {
      // Netzwerk: ohne Chooser direkt generieren, wie bisher
      await handleGenerateLetter(false)
    } finally {
      setMatching(false)
    }
  }

  async function generateFromChooser() {
    if (!job || !chooser) return
    const match = chooser.matches.find((m) => m.anecdoteId === chosenAnecdote)
    const need = match ? chooser.needs[match.addresses[0]] : undefined
    setChooser(null)
    await handleGenerateLetter(
      false,
      chosenAnecdote !== 'none' ? { anecdoteId: chosenAnecdote, need } : undefined
    )
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

        {/* Absage-Trichter: das emotional heikelste Moment der App bekommt
            einen Ausweg — die nächste Handlung liegt einen Klick entfernt */}
        {job.status === 'REJECTED' && (
          <div className="mb-6 p-4 bg-surface rounded-xl border border-border flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-primary">
              Absage notiert — Kopf hoch. Die Suche läuft weiter.
            </p>
            {unscoredCount > 0 ? (
              <Link
                href="/jobs?filter=unscored"
                className="text-sm font-medium text-selection hover:text-selection-strong transition-colors"
              >
                {unscoredCount} {unscoredCount === 1 ? 'Fund' : 'Funde'} warten auf eine Bewertung →
              </Link>
            ) : (
              <Link
                href="/search"
                className="text-sm font-medium text-selection hover:text-selection-strong transition-colors"
              >
                Neue Suche starten →
              </Link>
            )}
          </div>
        )}

        {job.score != null ? (
          <div className="bg-surface rounded-2xl p-6 border border-border mb-6">
            <div className="flex items-baseline gap-3 mb-3">
              <ScoreBadge score={job.score} size="xl" />
              <span className="text-sm text-primary-soft">KI-Score</span>
            </div>
            {job.scoreReason && (
              <p className="text-primary leading-relaxed">{job.scoreReason}</p>
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
            <p className="text-sm text-primary mb-4">
              Noch keine Bewertung. Die KI bewertet bei der Suche automatisch bis zu {SCORE_LIMIT}
              Treffer — dieser Job lag darüber oder wurde manuell hinzugefügt.
            </p>
            <Button size="sm" variant="secondary" onClick={() => void scoreNow()} disabled={busy !== null}>
              {busy === 'score' ? 'Bewertung läuft …' : 'Jetzt bewerten'}
            </Button>
          </div>
        )}

        {/* Bewerben-Gruppe: Anschreiben und Unterlagen bilden den Handlungsweg —
            direkt unter dem Urteil, nicht zwei Scroll-Screens tief zwischen
            Notiz und Beschreibung. Anker für Sprunglinks: #bewerben */}
        <div id="bewerben" className="bg-surface rounded-2xl p-6 border border-border mb-6">
          <h2 className="text-sm font-medium text-primary-soft mb-4">Anschreiben</h2>

          {!letter && !letterError && !chooser && (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-primary leading-relaxed max-w-prose">
                Aus deinem Lebenslauf und dieser Stellenanzeige — zum Bearbeiten, bevor du sie
                verschickst.
              </p>
              <Button onClick={() => void startLetterGeneration()} disabled={busy !== null || matching}>
                {busy === 'generate' ? 'Wird erzeugt …' : matching ? 'Wird geprüft …' : 'Anschreiben erzeugen'}
              </Button>
            </div>
          )}

          {/* Der Chooser: erst die Mutmaßungen (mit geprüften Zitatstellen), dann die Wahl */}
          {!letter && !letterError && chooser && (
            <div>
              <h3 className="text-sm font-medium text-foreground mb-1">
                Was die Anzeige zwischen den Zeilen sucht
              </h3>
              <p className="text-xs text-primary-soft mb-3">
                Mutmaßung, nicht Gewissheit — jede Belegstelle wurde wörtlich gegen den
                Anzeigentext geprüft.
              </p>
              <ul className="space-y-2 mb-5">
                {chooser.needs.map((guess, i) => (
                  <li key={`${guess.need}-${i}`} className="text-sm bg-background rounded-xl border border-border-soft p-3">
                    <p className="text-foreground">{guess.need}</p>
                    <p className="text-primary-soft mt-1">Zitat: „{guess.quote}“</p>
                    {guess.why && <p className="text-primary-soft mt-1">{guess.why}</p>}
                  </li>
                ))}
                {chooser.needs.length === 0 && (
                  <li className="text-sm text-primary-soft">
                    Keine belegten Mutmaßungen — die Anzeige sagt wenig zwischen den Zeilen.
                  </li>
                )}
              </ul>
              <fieldset>
                <legend className="text-sm font-medium text-foreground mb-2">
                  Welche Anekdote öffnet das Anschreiben?
                </legend>
                {!chooser.ranked && (
                  <p className="text-xs text-warning mb-2">
                    Rangliste gerade nicht verfügbar — wähle selbst.
                  </p>
                )}
                <div className="space-y-2">
                  {orderedChoices.slice(0, 3).map(({ anecdote, reason }) => (
                    <label
                      key={anecdote.id}
                      className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                        chosenAnecdote === anecdote.id ? 'border-selection' : 'border-border'
                      }`}
                    >
                      <input
                        type="radio"
                        name="anekdote-wahl"
                        value={anecdote.id}
                        checked={chosenAnecdote === anecdote.id}
                        onChange={() => setChosenAnecdote(anecdote.id)}
                        className="mt-1 accent-selection"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">{anecdote.title}</span>
                        {reason ? (
                          <span className="block text-xs text-primary-soft mt-0.5">{reason}</span>
                        ) : (
                          <span className="block text-xs text-primary-soft mt-0.5">
                            {anecdote.situation.slice(0, 90)}
                            {anecdote.situation.length > 90 ? '…' : ''}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                  {orderedChoices.length > 3 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowAllAnecdotes((prev) => !prev)}
                        aria-expanded={showAllAnecdotes}
                        className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors border border-dashed border-border text-primary-soft hover:text-foreground hover:border-primary-soft"
                      >
                        Aus allen {orderedChoices.length} Anekdoten wählen {showAllAnecdotes ? '▾' : '▸'}
                      </button>
                      {showAllAnecdotes &&
                        orderedChoices.slice(3).map(({ anecdote, reason }) => (
                          <label
                            key={anecdote.id}
                            className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                              chosenAnecdote === anecdote.id ? 'border-selection' : 'border-border'
                            }`}
                          >
                            <input
                              type="radio"
                              name="anekdote-wahl"
                              value={anecdote.id}
                              checked={chosenAnecdote === anecdote.id}
                              onChange={() => setChosenAnecdote(anecdote.id)}
                              className="mt-1 accent-selection"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-foreground">{anecdote.title}</span>
                              {reason ? (
                                <span className="block text-xs text-primary-soft mt-0.5">{reason}</span>
                              ) : (
                                <span className="block text-xs text-primary-soft mt-0.5">
                                  {anecdote.situation.slice(0, 90)}
                                  {anecdote.situation.length > 90 ? '…' : ''}
                                </span>
                              )}
                            </span>
                          </label>
                        ))}
                    </>
                  )}
                  <label
                    className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                      chosenAnecdote === 'none' ? 'border-selection' : 'border-border'
                    }`}
                  >
                    <input
                      type="radio"
                      name="anekdote-wahl"
                      value="none"
                      checked={chosenAnecdote === 'none'}
                      onChange={() => setChosenAnecdote('none')}
                      className="mt-1 accent-selection"
                    />
                    <span className="text-sm text-foreground">Ohne Anekdote — klassisches Anschreiben</span>
                  </label>
                </div>
              </fieldset>
              <div className="flex flex-wrap gap-3 mt-4">
                <Button onClick={() => void generateFromChooser()} disabled={busy !== null || matching}>
                  {busy === 'generate' ? 'Wird erzeugt …' : 'Anschreiben erzeugen'}
                </Button>
                <Button variant="secondary" onClick={() => setChooser(null)}>
                  Abbrechen
                </Button>
              </div>
            </div>
          )}

          {/* Leerer Bestand: kein Vorwurf, ein Angebot. Ohne die `letter`/`letterError`
              -Gates bleibt der Tipp sichtbar — er begleitet das Ergebnis, statt nur in
              dem einen Moment zu stehen, in dem noch keins existiert. */}
          {!chooser && anecdoteHint && (
            <p className="text-xs text-primary-soft mt-3">
              Tipp: Eine wahre Anekdote hebt dein Anschreiben von KI-Standardsatz ab.{' '}
              <Link
                href="/resume#anekdoten"
                className="underline decoration-selection/60 underline-offset-4 hover:text-foreground hover:decoration-selection"
              >
                Anekdoten anlegen
              </Link>
            </p>
          )}

          {letterError && (
            <div className="mb-4">
              <div role="alert" className="p-4 bg-error/10 rounded-xl border border-error/20 mb-4">
                <p className="text-sm text-primary">{letterError}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button size="sm" variant="secondary" onClick={() => void startLetterGeneration()}>
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
                  onClick={() => void startLetterGeneration()}
                  disabled={busy !== null || matching}
                >
                  {matching ? 'Wird geprüft …' : 'Neu erzeugen'}
                </Button>
                <button
                  onClick={() => {
                    if (!confirmingDiscardLetter) {
                      setConfirmingDiscardLetter(true)
                      setTimeout(() => setConfirmingDiscardLetter(false), 5000)
                      return
                    }
                    setConfirmingDiscardLetter(false)
                    setLetter(null)
                  }}
                  className={`text-sm underline underline-offset-4 transition-colors ${
                    confirmingDiscardLetter
                      ? 'text-error decoration-error/60 hover:decoration-error'
                      : 'text-primary decoration-selection/60 hover:text-foreground hover:decoration-selection'
                  }`}
                >
                  {confirmingDiscardLetter ? 'Verwerfen?' : 'Verwerfen'}
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

        {/* Notiz & Wiedervorlage — dieselben Felder wie im Cockpit: der Überblick
            dort, das Einzelheim hier, ein Schreibweg */}
        {job && (
          <div className="bg-surface rounded-2xl p-6 border border-border mb-6">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
              <h2 className="text-sm font-medium text-primary-soft">Notiz & Wiedervorlage</h2>
              {savedAt && (
                <span className="text-xs text-primary-soft tabular-nums" role="status">
                  Gespeichert um {savedAt}
                </span>
              )}
              <label className="flex items-center gap-2 text-sm">
                <span className="text-primary-soft">Wiedervorlage</span>
                <input
                  type="date"
                  value={followUp}
                  onChange={(e) => {
                    setSavedAt(null)
                    setFollowUp(e.target.value)
                    void saveFollowUp(e.target.value)
                  }}
                  aria-label="Wiedervorlage"
                  className="px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground text-sm tabular-nums"
                />
              </label>
              {job.followUpAt != null && isDue(job.followUpAt, new Date()) && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning border border-warning/20">
                  Fällig
                </span>
              )}
            </div>
            <textarea
              value={notes}
              onChange={(e) => {
                setSavedAt(null)
                setNotes(e.target.value)
              }}
              onBlur={() => void saveNotes()}
              rows={3}
              placeholder="Gesprächsverlauf, Ansprechpartner, nächster Schritt …"
              aria-label="Notiz zu diesem Job"
              className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-primary-soft text-sm leading-relaxed resize-y"
            />
          </div>
        )}

        {/* Anzeigentext als Referenz-Material, nicht als Seitenabschluss:
            hinter einer Disclosure, mit kurzem Vorspann für die eingeklappte
            Ansicht. <details>/<summary> bringt Tastatur und Screenreader
            ohne eigenen State */}
        <details className="bg-surface rounded-2xl border border-border mb-6 group">
          <summary className="p-6 cursor-pointer list-none [&::-webkit-details-marker]:hidden transition-colors">
            <span className="text-sm font-medium text-primary-soft group-open:text-foreground">
              Anzeigentext (Portal)
            </span>
            <span aria-hidden="true" className="text-xs text-primary-soft ml-2">
              {job.description
                ? `${job.description.replace(/\s+/g, ' ').trim().slice(0, 140)}${job.description.replace(/\s+/g, ' ').trim().length > 140 ? ' …' : ''}`
                : 'Kein Text vorhanden'}
            </span>
            <span aria-hidden="true" className="block text-xs text-selection mt-1 group-open:hidden">
              Anzeigen ▸
            </span>
            <span aria-hidden="true" className="hidden text-xs text-selection mt-1 group-open:block">
              Einklappen ▾
            </span>
          </summary>
          <div className="px-6 pb-6 prose max-w-none">
            {/* Strukturiert (Entities, Bullets, Satz-Absätze, Anzeigen-Überschriften) gerendert —
                keine Formatierungsartefakte und keine Textwände aus den Job-Börsen-Feeds */}
            <MarkdownContent content={structureJobDescription(job.description ?? '')} variant="description" />
          </div>
        </details>

        {/* Ruhiger Abschluss mit Rückweg — die Seite endet nicht in der Anzeige */}
        <div className="mb-6">
          <Link
            href="/jobs"
            className="text-sm text-primary hover:text-selection transition-colors"
          >
            ← Zurück zu allen Jobs
          </Link>
        </div>

      </main>
    </div>
  )
}
