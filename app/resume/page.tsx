'use client'

import { useEffect, useState, useRef } from 'react'
import { useToast } from '../components/Toast'
import { MarkdownContent } from '../components/Markdown'

interface Resume {
  id: string
  name: string
  content: string
  createdAt: string
  updatedAt: string
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

  useEffect(() => {
    fetchResume()
  }, [])

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

  async function handleDownloadPDF() {
    setDownloading(true)
    try {
      const response = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'resume' }),
      })
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'Resume.pdf'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        toast.error('PDF Generierung fehlgeschlagen')
      }
    } catch {
      toast.error('PDF Generierung fehlgeschlagen')
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
                onClick={handleDownloadPDF}
                disabled={downloading}
                className="px-5 py-2.5 bg-border-soft hover:bg-border text-foreground rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
              >
                {downloading ? 'Wird geladen …' : 'Als PDF'}
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
                accept=".pdf,.txt,.md,.markdown"
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
                    Klicken und PDF-, .txt- oder .md-Datei wählen
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
                className="w-full py-3 bg-accent hover:bg-accent-strong text-surface rounded-xl font-medium transition-colors disabled:opacity-50"
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
                className="px-6 py-3 bg-accent hover:bg-accent-strong text-surface rounded-xl font-medium transition-colors disabled:opacity-50"
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

        {/* Tip */}
        {resume && mode === 'view' && (
          <section className="bg-success/10 rounded-2xl p-6 border border-success/20">
            <h3 className="font-medium text-success mb-2">Tipp</h3>
            <p className="text-foreground text-sm leading-relaxed">
              Dein Lebenslauf wird verwendet, um Jobs zu bewerten und Matches zu finden.
              Je mehr Details (Skills, Erfahrung, Projekte), desto besser die KI-Treffer.
            </p>
          </section>
        )}
      </main>
    </div>
  )
}
