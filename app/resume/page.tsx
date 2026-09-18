'use client'

import { useEffect, useState, useRef, useId } from 'react'
import Link from 'next/link'
import { useToast } from '../components/Toast'
import { MarkdownContent } from '../components/Markdown'
import { Button } from '../components/ui'
import { EXTRACT_QUESTIONS, parseSkills } from '@/lib/anecdotes'

interface Resume {
  id: string
  name: string
  content: string
  createdAt: string
  updatedAt: string
}

// Anekdoten: wahre Geschichten als Material fürs Anschreiben. `skills` kommt
// als JSON-String aus der DB und wird an der Grenze geparst.
interface Anecdote {
  id: string
  title: string
  situation: string
  action: string
  result: string
  skills: string
  source: string
  createdAt: string
}

// Vorschlag aus der Extraktion — lebt nur im Client-State, bis er bestätigt wird
interface Proposal {
  title: string
  situation: string
  action: string
  result: string
  skills: string[]
}

export default function ResumePage() {
  const toast = useToast()
  const [resume, setResume] = useState<Resume | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [mode, setMode] = useState<'view' | 'upload' | 'edit'>('view')
  const [content, setContent] = useState('')
  const [pastedText, setPastedText] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Nach frischem Upload/Save: Hinweis aufs Präferenz-Gespräch. Kein Auto-
  // Redirect — die PDF-Extraktion ist verlustbehaftet, der Nutzer soll den
  // geparsten Text zuerst prüfen können.
  const [showPrefCta, setShowPrefCta] = useState(false)

  // Anekdoten: eigene Sektion mit eigenem Ladezyklus — sie hängt nicht am Modus
  // des Lebenslaufs (view/upload/edit), sondern steht immer unten.
  const [anecdotes, setAnecdotes] = useState<Anecdote[]>([])
  const [anecdotePanel, setAnecdotePanel] = useState<'none' | 'extract' | 'manual'>('none')
  const [editingAnecdote, setEditingAnecdote] = useState<Anecdote | null>(null)
  const [proposals, setProposals] = useState<Proposal[] | null>(null)

  useEffect(() => {
    fetchResume()
  }, [])

  useEffect(() => {
    void fetchAnecdotes()
  }, [])

  // Next 16 läuft den Hash-Scroll einmalig beim Navigieren — zu dem Zeitpunkt
  // existiert die Sektion noch nicht (Lade-Gate). Einmal nachziehen, wenn klar ist.
  useEffect(() => {
    if (!loading && window.location.hash === '#anekdoten') {
      document.getElementById('anekdoten')?.scrollIntoView()
    }
  }, [loading])

  async function fetchResume() {
    try {
      const response = await fetch('/api/resume')
      const data = await response.json()
      if (data?.id) {
        setResume(data)
        setContent(data.content)
      } else {
        setMode('upload')
      }
    } catch (error) {
      console.error('Failed to fetch resume:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchAnecdotes() {
    try {
      const response = await fetch('/api/anecdotes')
      if (response.ok) {
        const data = await response.json()
        setAnecdotes(Array.isArray(data) ? data : [])
      }
    } catch {
      // Stille Liste: ohne Anekdoten bleibt die Sektion einfach leer
    }
  }

  async function deleteAnecdote(id: string) {
    try {
      const response = await fetch(`/api/anecdotes/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        toast.error('Löschen fehlgeschlagen — die Geschichte bleibt erhalten.')
        return
      }
      setAnecdotes((prev) => prev.filter((a) => a.id !== id))
      toast.success('Anekdote gelöscht.')
    } catch {
      toast.error('Netzwerkfehler — die Geschichte bleibt erhalten.')
    }
  }

  // Übernahme eines Vorschlags: erst jetzt wird er wahr — und nur einzeln.
  async function saveProposal(edited: Proposal, original: Proposal) {
    try {
      const response = await fetch('/api/anecdotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...edited, source: 'interview' }),
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => undefined)) as { error?: string } | undefined
        toast.error(data?.error ?? 'Speichern fehlgeschlagen — der Vorschlag bleibt stehen.')
        return
      }
      const saved: Anecdote = await response.json()
      setAnecdotes((prev) => [saved, ...prev])
      setProposals((prev) => {
        const rest = prev?.filter((p) => p !== original) ?? []
        return rest.length > 0 ? rest : null
      })
      toast.success('Anekdote übernommen.')
    } catch {
      toast.error('Netzwerkfehler — der Vorschlag bleibt stehen.')
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/resume/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        setMode('view')
        setShowPrefCta(true)
        fetchResume()
      } else {
        const data = await response.json().catch(() => ({}))
        toast.error(data.error || 'Fehler beim Speichern')
      }
    } catch {
      toast.error('Datei konnte nicht hochgeladen werden')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handlePasteSubmit() {
    if (!pastedText.trim()) return

    setLoading(true)
    try {
      const response = await fetch('/api/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Mein Resume',
          content: pastedText,
        }),
      })

      if (response.ok) {
        setMode('view')
        setPastedText('')
        setShowPrefCta(true)
        fetchResume()
      }
    } catch {
      toast.error('Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  async function saveEdit() {
    setLoading(true)
    try {
      const response = await fetch('/api/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: resume?.name || 'Mein Resume', content }),
      })
      if (response.ok) {
        setMode('view')
        fetchResume()
      }
    } catch {
      toast.error('Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  async function handleDownloadPDF(format: 'pdf' | 'docx' = 'pdf') {
    setDownloading(true)
    try {
      const response = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'resume', format }),
      })
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `Lebenslauf.${format}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        toast.error('Dokument konnte nicht erzeugt werden')
      }
    } catch {
      toast.error('Dokument konnte nicht erzeugt werden')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-primary-soft">Lade Lebenslauf …</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <section className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-3xl font-light text-foreground mb-2">
              Lebenslauf
            </h1>
            <p className="text-primary-soft">
              {resume ? 'Dein Lebenslauf für KI-Matching' : 'Lade deinen Lebenslauf hoch'}
            </p>
          </div>
          {resume && mode === 'view' && (
            <div className="flex gap-3">
              <button
                onClick={() => void handleDownloadPDF('pdf')}
                disabled={downloading}
                className="px-5 py-2.5 bg-border-soft hover:bg-border text-foreground rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
              >
                {downloading ? 'Wird geladen …' : 'Als PDF'}
              </button>
              <button
                onClick={() => void handleDownloadPDF('docx')}
                disabled={downloading}
                className="px-5 py-2.5 bg-border-soft hover:bg-border text-foreground rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
              >
                {downloading ? 'Wird geladen …' : 'Als DOCX'}
              </button>
              <button
                onClick={() => setMode('edit')}
                className="px-5 py-2.5 bg-border-soft hover:bg-border text-foreground rounded-xl font-medium text-sm transition-colors"
              >
                Bearbeiten
              </button>
              {/* Selten + ersatzlos — deshalb Sekundär, nicht der eine Ocker-Primary */}
              <button
                onClick={() => setMode('upload')}
                className="px-5 py-2.5 bg-border-soft hover:bg-border text-foreground rounded-xl font-medium text-sm transition-colors"
              >
                Ersetzen
              </button>
            </div>
          )}
        </section>

        {/* Upload Mode */}
        {mode === 'upload' && (
          <section className="space-y-8">
            {/* File Upload — echter Button statt div onClick: Tastatur und
                Screenreader bekommen denselben Weg wie die Maus */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full bg-surface rounded-2xl p-12 border-2 border-dashed border-border hover:border-accent cursor-pointer transition-colors text-center"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,.markdown"
                onChange={handleFileUpload}
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
              />
              {uploading ? (
                <p className="text-primary-soft">Wird hochgeladen …</p>
              ) : (
                <>
                  <p className="text-foreground font-medium mb-2">
                    Datei hochladen
                  </p>
                  <p className="text-sm text-primary-soft">
                    Klicken und PDF-, DOCX-, .txt- oder .md-Datei wählen
                  </p>
                </>
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-sm text-primary-soft">oder</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Paste Text */}
            <div className="bg-surface rounded-2xl p-8 border border-border shadow-sm">
              <label className="block text-sm font-medium text-foreground mb-3">
                Text einfügen
              </label>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={10}
                placeholder="Füge hier deinen Lebenslauf ein..."
              />
              <button
                onClick={handlePasteSubmit}
                disabled={loading || !pastedText.trim()}
                className="w-full py-3 bg-accent hover:bg-accent-strong text-on-accent rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Wird gespeichert...' : 'Speichern'}
              </button>
            </div>
          </section>
        )}

        {/* Edit Mode */}
        {mode === 'edit' && resume && (
          <section className="bg-surface rounded-2xl p-8 border border-border shadow-sm">
            <label htmlFor="resume-edit" className="block text-sm font-medium text-foreground mb-3">
              Lebenslauf bearbeiten (Markdown)
            </label>
            <textarea
              id="resume-edit"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              className="w-full px-5 py-4 rounded-xl border border-border bg-background text-foreground font-mono text-sm leading-relaxed resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={saveEdit}
                disabled={loading}
                className="px-6 py-3 bg-accent hover:bg-accent-strong text-on-accent rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Speichert …' : 'Speichern'}
              </button>
              {/* Ungespeicherte Änderungen gehen nicht still verloren —
                  zweiter Klick verwirft bewusst */}
              <button
                onClick={() => {
                  if (content !== resume.content && !confirmDiscard) {
                    setConfirmDiscard(true)
                    setTimeout(() => setConfirmDiscard(false), 5000)
                    return
                  }
                  setConfirmDiscard(false)
                  setMode('view')
                  setContent(resume.content)
                }}
                className={`px-6 py-3 rounded-xl font-medium transition-colors ${
                  confirmDiscard
                    ? 'bg-error/10 text-error border border-error/20'
                    : 'bg-border-soft hover:bg-border text-foreground'
                }`}
              >
                {confirmDiscard ? 'Änderungen wirklich verwerfen' : 'Abbrechen'}
              </button>
            </div>
          </section>
        )}

        {/* View Mode */}
        {mode === 'view' && resume && (
          <>
          {showPrefCta && (
            <section className="bg-accent-soft/30 rounded-2xl p-6 border border-accent/20 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <p className="text-foreground font-medium mb-1">
                  Dein Lebenslauf steht — jetzt klären, was du wirklich willst
                </p>
                <p className="text-sm text-primary-soft">
                  Im kurzen KI-Gespräch (ca. 10 Minuten) erfasst du, was dir Freude macht und
                  wichtig ist. Das Präferenzen-Profil fließt in jede Job-Bewertung und Suche ein.
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <Link
                  href="/preferences"
                  className="px-5 py-2.5 bg-accent hover:bg-accent-strong text-on-accent rounded-xl font-medium text-sm transition-colors"
                >
                  Präferenz-Gespräch starten
                </Link>
                <button
                  onClick={() => setShowPrefCta(false)}
                  className="text-sm text-primary-soft hover:text-foreground transition-colors"
                >
                  Später
                </button>
              </div>
            </section>
          )}
          {resume.updatedAt && (
            <p className="text-sm text-primary-soft mb-4 tabular-nums">
              Zuletzt aktualisiert: {new Date(resume.updatedAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
          <section className="bg-surface rounded-2xl p-10 border border-border shadow-sm mb-6">
            <h2 className="text-xl font-medium text-foreground mb-6">
              {resume.name}
            </h2>
            <MarkdownContent content={content} />
          </section>
          </>
        )}

        {/* Anekdoten — wahre Geschichten als Material fürs Anschreiben */}
        <section id="anekdoten" className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-medium text-foreground">Anekdoten</h2>
              <p className="text-sm text-primary-soft">
                Wahre Geschichten, die dein Anschreiben von KI-Standardsatz trennen.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setAnecdotePanel(anecdotePanel === 'extract' ? 'none' : 'extract')}
              >
                Geschichten erzählen
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setEditingAnecdote(null)
                  setAnecdotePanel(anecdotePanel === 'manual' ? 'none' : 'manual')
                }}
              >
                Selbst schreiben
              </Button>
            </div>
          </div>

          {anecdotePanel === 'extract' && (
            <ExtractPanel
              onProposals={(list) => {
                setProposals(list)
                setAnecdotePanel('none')
              }}
              onCancel={() => setAnecdotePanel('none')}
            />
          )}

          {proposals && proposals.length > 0 && (
            <div className="mb-4 space-y-4">
              <p className="text-sm text-primary-soft">
                Vorschläge aus deinen Geschichten — prüfe jede, bevor du sie übernimmst.
              </p>
              {proposals.map((proposal) => (
                <ProposalCard
                  key={proposal.title + proposal.situation}
                  proposal={proposal}
                  onSave={(edited) => saveProposal(edited, proposal)}
                  onDiscard={() =>
                    setProposals((prev) => {
                      const rest = prev?.filter((p) => p !== proposal) ?? []
                      return rest.length > 0 ? rest : null
                    })
                  }
                />
              ))}
            </div>
          )}

          {anecdotePanel === 'manual' && (
            <div className="mb-4">
              <AnecdoteForm
                key={editingAnecdote ? editingAnecdote.id : 'neu'}
                anecdote={editingAnecdote}
                onSaved={(saved) => {
                  setAnecdotes((prev) => {
                    const exists = prev.some((a) => a.id === saved.id)
                    return exists ? prev.map((a) => (a.id === saved.id ? saved : a)) : [saved, ...prev]
                  })
                  setAnecdotePanel('none')
                  setEditingAnecdote(null)
                  toast.success('Anekdote gespeichert.')
                }}
                onCancel={() => {
                  setAnecdotePanel('none')
                  setEditingAnecdote(null)
                }}
              />
            </div>
          )}

          {anecdotes.length > 0 ? (
            <div className="space-y-4">
              {anecdotes.map((a) => (
                <AnecdoteCard
                  key={a.id}
                  anecdote={a}
                  onEdit={() => {
                    setEditingAnecdote(a)
                    setAnecdotePanel('manual')
                  }}
                  onDelete={() => void deleteAnecdote(a.id)}
                />
              ))}
            </div>
          ) : (
            anecdotePanel === 'none' && (
              <p className="text-sm text-primary-soft bg-surface rounded-2xl p-6 border border-border">
                Noch keine Anekdoten. Erzähl drei kurze Geschichten — die App formt daraus Karten.
              </p>
            )
          )}
        </section>

      </main>
    </div>
  )
}

// Formular für „Selbst schreiben" und Bearbeiten — dieselben vier Felder wie
// die Extraktions-Karten. Skills werden kommagetrennt eingegeben.
function AnecdoteForm({
  anecdote,
  onSaved,
  onCancel,
}: {
  anecdote: Anecdote | null
  onSaved: (saved: Anecdote) => void
  onCancel: () => void
}) {
  const toast = useToast()
  const [title, setTitle] = useState(anecdote?.title ?? '')
  const [situation, setSituation] = useState(anecdote?.situation ?? '')
  const [action, setAction] = useState(anecdote?.action ?? '')
  const [result, setResult] = useState(anecdote?.result ?? '')
  const [skills, setSkills] = useState(
    anecdote ? parseSkills(anecdote.skills).join(', ') : ''
  )
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!title.trim() || !situation.trim() || !action.trim() || !result.trim()) {
      toast.error('Alle vier Felder gehören zur Geschichte.')
      return
    }
    setSaving(true)
    try {
      const response = await fetch(anecdote ? `/api/anecdotes/${anecdote.id}` : '/api/anecdotes', {
        method: anecdote ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          situation,
          action,
          result,
          skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => undefined)) as { error?: string } | undefined
        toast.error(data?.error ?? 'Speichern fehlgeschlagen — die Geschichte bleibt unverändert.')
        return
      }
      onSaved(await response.json())
    } catch {
      toast.error('Netzwerkfehler — die Geschichte bleibt unverändert.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground text-sm leading-relaxed resize-y'

  return (
    <div className="bg-surface rounded-2xl p-6 border border-border space-y-4">
      <div>
        <label htmlFor="anecdote-title" className="block text-sm font-medium text-foreground mb-2">
          Titel
        </label>
        <input
          id="anecdote-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm"
          placeholder="z. B. Der Deploy-Freitag"
        />
      </div>
      <div>
        <label htmlFor="anecdote-situation" className="block text-sm font-medium text-foreground mb-2">
          Situation
        </label>
        <textarea id="anecdote-situation" value={situation} onChange={(e) => setSituation(e.target.value)} rows={2} className={inputClass} />
      </div>
      <div>
        <label htmlFor="anecdote-action" className="block text-sm font-medium text-foreground mb-2">
          Was ich getan habe
        </label>
        <textarea id="anecdote-action" value={action} onChange={(e) => setAction(e.target.value)} rows={3} className={inputClass} />
      </div>
      <div>
        <label htmlFor="anecdote-result" className="block text-sm font-medium text-foreground mb-2">
          Ergebnis
        </label>
        <textarea id="anecdote-result" value={result} onChange={(e) => setResult(e.target.value)} rows={2} className={inputClass} />
      </div>
      <div>
        <label htmlFor="anecdote-skills" className="block text-sm font-medium text-foreground mb-2">
          Qualitäten (Komma-getrennt)
        </label>
        <input
          id="anecdote-skills"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm"
          placeholder="Druck, Entscheidung, Kommunikation"
        />
      </div>
      <div className="flex gap-3">
        <Button size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? 'Speichert …' : anecdote ? 'Änderungen speichern' : 'Speichern'}
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel}>
          Abbrechen
        </Button>
      </div>
    </div>
  )
}

// Eine Karte, eine Geschichte: geraffte Ansicht, Bearbeiten springt ins
// Formular, Löschen ist zweistufig (zweiter Klick bestätigt, Timeout nimmt
// die Schärfe nach fünf Sekunden wieder raus).
function AnecdoteCard({
  anecdote,
  onEdit,
  onDelete,
}: {
  anecdote: Anecdote
  onEdit: () => void
  onDelete: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const skills = parseSkills(anecdote.skills)

  return (
    <div className="bg-surface rounded-2xl p-6 border border-border">
      <div className="flex items-start justify-between gap-4 mb-3">
        <h3 className="text-lg font-medium text-foreground">{anecdote.title}</h3>
        <div className="flex gap-2 flex-shrink-0">
          <Button size="sm" variant="secondary" onClick={onEdit}>
            Bearbeiten
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className={confirming ? 'bg-error/10 text-error border border-error/20 hover:bg-error/20' : undefined}
            onClick={() => {
              if (!confirming) {
                setConfirming(true)
                setTimeout(() => setConfirming(false), 5000)
                return
              }
              onDelete()
            }}
          >
            {confirming ? 'Wirklich löschen' : 'Löschen'}
          </Button>
        </div>
      </div>
      <dl className="text-sm text-primary leading-relaxed space-y-1.5 mb-3">
        <div>
          <dt className="sr-only">Situation</dt>
          <dd>
            <span className="text-primary-soft">Situation: </span>
            {anecdote.situation}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Was ich getan habe</dt>
          <dd>
            <span className="text-primary-soft">Getan: </span>
            {anecdote.action}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Ergebnis</dt>
          <dd>
            <span className="text-primary-soft">Ergebnis: </span>
            {anecdote.result}
          </dd>
        </div>
      </dl>
      {skills.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Belegte Qualitäten">
          {skills.map((skill) => (
            <li key={skill} className="px-2.5 py-1 rounded-full text-xs border border-border text-primary-soft">
              {skill}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Das Mini-Interview (A1): drei Leitfragen, ein KI-Aufruf. Ein Ausfall ist
// ehrlich — die Antworten bleiben im Formular, nichts ist verloren.
function ExtractPanel({
  onProposals,
  onCancel,
}: {
  onProposals: (proposals: Proposal[]) => void
  onCancel: () => void
}) {
  const [answers, setAnswers] = useState<string[]>(['', '', ''])
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function extract() {
    setExtracting(true)
    setError(null)
    try {
      const response = await fetch('/api/anecdotes/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const data = (await response.json().catch(() => undefined)) as
        | { proposals?: Proposal[]; error?: string }
        | undefined
      if (!response.ok) {
        setError(data?.error ?? 'Die KI ist nicht erreichbar — deine Antworten bleiben im Formular, nichts ist verloren.')
        return
      }
      const list = Array.isArray(data?.proposals) ? data.proposals : []
      if (list.length === 0) {
        setError('Aus diesen Geschichten ließ sich nichts formen — erzähl mehr Details oder schreib eine Anekdote selbst.')
        return
      }
      onProposals(list)
    } catch {
      setError('Netzwerkfehler — deine Antworten bleiben im Formular, nichts ist verloren.')
    } finally {
      setExtracting(false)
    }
  }

  return (
    <div className="bg-surface rounded-2xl p-6 border border-border mb-4 space-y-4">
      {EXTRACT_QUESTIONS.map((question, i) => (
        <div key={question}>
          <label htmlFor={`story-${i}`} className="block text-sm font-medium text-foreground mb-2">
            {i + 1}. {question}
          </label>
          <textarea
            id={`story-${i}`}
            value={answers[i]}
            onChange={(e) =>
              setAnswers((prev) => prev.map((a, j) => (j === i ? e.target.value : a)))
            }
            rows={3}
            placeholder="Erzähl frei — Fakten, Zahlen, Namen bleiben bei dir, solange du nichts speicherst."
            className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground text-sm leading-relaxed resize-y"
          />
        </div>
      ))}
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button
          size="sm"
          onClick={() => void extract()}
          disabled={extracting || answers.every((a) => !a.trim())}
        >
          {extracting ? 'Wird geformt …' : 'Geschichten formen lassen'}
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel}>
          Abbrechen
        </Button>
      </div>
    </div>
  )
}

// Eine Karte, ein Vorschlag: alles editierbar, bevor etwas gespeichert wird.
function ProposalCard({
  proposal,
  onSave,
  onDiscard,
}: {
  proposal: Proposal
  onSave: (edited: Proposal) => Promise<void>
  onDiscard: () => void
}) {
  const [title, setTitle] = useState(proposal.title)
  const [situation, setSituation] = useState(proposal.situation)
  const [action, setAction] = useState(proposal.action)
  const [result, setResult] = useState(proposal.result)
  const [skills, setSkills] = useState(proposal.skills.join(', '))
  const [saving, setSaving] = useState(false)
  // useId: mehrere Karten dürfen sich nie dieselben Label-IDs teilen
  const id = useId()

  const inputClass =
    'w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground text-sm leading-relaxed resize-y'

  return (
    <div className="bg-surface rounded-2xl p-6 border border-border space-y-3">
      <div>
        <label htmlFor={`${id}-titel`} className="block text-sm font-medium text-foreground mb-2">
          Titel
        </label>
        <input
          id={`${id}-titel`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm"
        />
      </div>
      <div>
        <label htmlFor={`${id}-situation`} className="block text-sm font-medium text-foreground mb-2">
          Situation
        </label>
        <textarea id={`${id}-situation`} value={situation} onChange={(e) => setSituation(e.target.value)} rows={2} className={inputClass} />
      </div>
      <div>
        <label htmlFor={`${id}-aktion`} className="block text-sm font-medium text-foreground mb-2">
          Was ich getan habe
        </label>
        <textarea id={`${id}-aktion`} value={action} onChange={(e) => setAction(e.target.value)} rows={3} className={inputClass} />
      </div>
      <div>
        <label htmlFor={`${id}-ergebnis`} className="block text-sm font-medium text-foreground mb-2">
          Ergebnis
        </label>
        <textarea id={`${id}-ergebnis`} value={result} onChange={(e) => setResult(e.target.value)} rows={2} className={inputClass} />
      </div>
      <div>
        <label htmlFor={`${id}-qualitaeten`} className="block text-sm font-medium text-foreground mb-2">
          Qualitäten (Komma-getrennt)
        </label>
        <input
          id={`${id}-qualitaeten`}
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm"
        />
      </div>
      <div className="flex gap-3">
        <Button
          size="sm"
          disabled={saving || !title.trim() || !situation.trim() || !action.trim() || !result.trim()}
          onClick={() => {
            setSaving(true)
            onSave({
              title,
              situation,
              action,
              result,
              skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
            }).finally(() => setSaving(false))
          }}
        >
          Übernehmen
        </Button>
        <Button size="sm" variant="secondary" onClick={onDiscard}>
          Verwerfen
        </Button>
      </div>
    </div>
  )
}
