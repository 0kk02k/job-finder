'use client'

import { useEffect, useState, useRef } from 'react'
import { useToast } from '../components/Toast'

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
                onClick={handleDownloadPDF}
                disabled={downloading}
                className="px-5 py-2.5 bg-[var(--color-border-soft)] hover:bg-[var(--color-border)] text-[var(--color-foreground)] rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
              >
                {downloading ? '…' : '📄 Als PDF'}
              </button>
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
          <>
          {resume.updatedAt && (
            <p className="text-sm text-[var(--color-primary-soft)] mb-4">
              Zuletzt aktualisiert: {new Date(resume.updatedAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
          <section className="bg-[var(--color-surface)] rounded-2xl p-10 border border-[var(--color-border)] shadow-sm mb-6">
            <h2 className="text-xl font-medium text-[var(--color-foreground)] mb-6">
              {resume.name}
            </h2>
            <MarkdownContent content={content} />
          </section>
          </>
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

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: string[] = []

  function flushList(key: number) {
    if (listItems.length === 0) return
    elements.push(
      <ul key={`list-${key}`} className="list-disc pl-5 space-y-1 mb-3 text-[var(--color-foreground)] text-sm">
        {listItems.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    )
    listItems = []
  }

  lines.forEach((line, i) => {
    const trimmed = line.trim()

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listItems.push(trimmed.slice(2))
      return
    }

    flushList(i)

    if (trimmed.startsWith('### ')) {
      elements.push(<h4 key={i} className="text-sm font-medium text-[var(--color-foreground)] mt-4 mb-2">{renderInline(trimmed.slice(4))}</h4>)
    } else if (trimmed.startsWith('## ')) {
      elements.push(<h3 key={i} className="text-base font-medium text-[var(--color-foreground)] mt-5 mb-2">{renderInline(trimmed.slice(3))}</h3>)
    } else if (trimmed.startsWith('# ')) {
      elements.push(<h2 key={i} className="text-lg font-medium text-[var(--color-foreground)] mt-6 mb-3">{renderInline(trimmed.slice(2))}</h2>)
    } else if (trimmed === '') {
      // skip empty lines
    } else {
      elements.push(<p key={i} className="text-[var(--color-foreground)] text-sm leading-relaxed mb-3">{renderInline(trimmed)}</p>)
    }
  })

  flushList(lines.length)

  return <div>{elements}</div>
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}
