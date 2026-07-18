'use client'

import { useEffect, useState, useRef } from 'react'

interface Resume {
  id: string
  name: string
  content: string
  createdAt: string
}

export default function ResumePage() {
  const [resume, setResume] = useState<Resume | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [mode, setMode] = useState<'view' | 'upload' | 'edit'>('view')
  const [content, setContent] = useState('')
  const [pastedText, setPastedText] = useState('')
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
        alert(data.error || 'Fehler beim Speichern')
      }
    } catch {
      alert('Datei konnte nicht hochgeladen werden')
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
      alert('Fehler beim Speichern')
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
      alert('Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <p className="text-[var(--color-primary-soft)]">Lade Resume...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <section className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-3xl font-light text-[var(--color-foreground)] mb-2">
              Resume
            </h1>
            <p className="text-[var(--color-primary-soft)]">
              {resume ? 'Dein Lebenslauf für KI-Matching' : 'Lade deinen Lebenslauf hoch'}
            </p>
          </div>
          {resume && mode === 'view' && (
            <div className="flex gap-3">
              <button
                onClick={() => setMode('edit')}
                className="px-5 py-2.5 bg-[var(--color-border-soft)] hover:bg-[var(--color-border)] text-[var(--color-foreground)] rounded-xl font-medium text-sm transition-colors"
              >
                Bearbeiten
              </button>
              <button
                onClick={() => setMode('upload')}
                className="px-5 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-[var(--color-surface)] rounded-xl font-medium text-sm transition-colors"
              >
                Ersetzen
              </button>
            </div>
          )}
        </section>

        {/* Upload Mode */}
        {mode === 'upload' && (
          <section className="space-y-8">
            {/* File Upload */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="bg-[var(--color-surface)] rounded-2xl p-12 border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] cursor-pointer transition-colors text-center"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.markdown"
                onChange={handleFileUpload}
                className="hidden"
              />
              {uploading ? (
                <p className="text-[var(--color-primary-soft)]">Wird hochgeladen...</p>
              ) : (
                <>
                  <p className="text-4xl mb-4">📄</p>
                  <p className="text-[var(--color-foreground)] font-medium mb-2">
                    Datei hochladen
                  </p>
                  <p className="text-sm text-[var(--color-primary-soft)]">
                    Klicken und PDF, .txt oder .md Datei wählen
                  </p>
                </>
              )}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-[var(--color-border)]" />
              <span className="text-sm text-[var(--color-primary-soft)]">oder</span>
              <div className="flex-1 h-px bg-[var(--color-border)]" />
            </div>

            {/* Paste Text */}
            <div className="bg-[var(--color-surface)] rounded-2xl p-8 border border-[var(--color-border)] shadow-sm">
              <label className="block text-sm font-medium text-[var(--color-foreground)] mb-3">
                Text einfügen
              </label>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={10}
                placeholder="Füge hier deinen Lebenslauf ein..."
                className="w-full px-5 py-4 rounded-xl border border-[var(--color-border)] bg-[var(--background)] text-[var(--color-foreground)] text-sm leading-relaxed placeholder:text-[var(--color-primary-soft)] focus:border-[var(--color-accent)] focus:outline-none resize-none mb-4"
              />
              <button
                onClick={handlePasteSubmit}
                disabled={loading || !pastedText.trim()}
                className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-[var(--color-surface)] rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Wird gespeichert...' : 'Speichern'}
              </button>
            </div>
          </section>
        )}

        {/* Edit Mode */}
        {mode === 'edit' && resume && (
          <section className="bg-[var(--color-surface)] rounded-2xl p-8 border border-[var(--color-border)] shadow-sm">
            <label className="block text-sm font-medium text-[var(--color-foreground)] mb-3">
              Resume bearbeiten (Markdown)
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              className="w-full px-5 py-4 rounded-xl border border-[var(--color-border)] bg-[var(--background)] text-[var(--color-foreground)] font-mono text-sm leading-relaxed focus:border-[var(--color-accent)] focus:outline-none resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={saveEdit}
                disabled={loading}
                className="px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-[var(--color-surface)] rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Speichert...' : 'Speichern'}
              </button>
              <button
                onClick={() => {
                  setMode('view')
                  setContent(resume.content)
                }}
                className="px-6 py-3 bg-[var(--color-border-soft)] hover:bg-[var(--color-border)] text-[var(--color-foreground)] rounded-xl font-medium transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </section>
        )}

        {/* View Mode */}
        {mode === 'view' && resume && (
          <section className="bg-[var(--color-surface)] rounded-2xl p-10 border border-[var(--color-border)] shadow-sm mb-6">
            <h2 className="text-xl font-medium text-[var(--color-foreground)] mb-6">
              {resume.name}
            </h2>
            <div className="whitespace-pre-wrap text-[var(--color-foreground)] leading-relaxed text-sm">
              {content}
            </div>
          </section>
        )}

        {/* Tip */}
        {resume && mode === 'view' && (
          <section className="bg-[var(--color-success)]/10 rounded-2xl p-6 border border-[var(--color-success)]/20">
            <h3 className="font-medium text-[var(--color-success)] mb-2">💡 Tipp</h3>
            <p className="text-[var(--color-foreground)] text-sm leading-relaxed">
              Dein Resume wird verwendet, um Jobs zu bewerten und Matches zu finden.
              Je mehr Details (Skills, Erfahrung, Projekte), desto besser die KI-Treffer.
            </p>
          </section>
        )}
      </main>
    </div>
  )
}
