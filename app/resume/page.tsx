'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Resume {
  id: string
  name: string
  content: string
  createdAt: string
}

export default function ResumePage() {
  const [resume, setResume] = useState<Resume | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState('')

  useEffect(() => {
    fetchResume()
  }, [])

  async function fetchResume() {
    try {
      const response = await fetch('/api/resume')
      const data = await response.json()
      if (data) {
        setResume(data)
        setContent(data.content)
      }
    } catch (error) {
      console.error('Failed to fetch resume:', error)
    } finally {
      setLoading(false)
    }
  }

  async function saveResume() {
    setLoading(true)
    try {
      const response = await fetch('/api/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Mein Resume',
          content,
        }),
      })

      if (response.ok) {
        setEditing(false)
        fetchResume()
      }
    } catch (error) {
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
      {/* Navigation */}
      <nav className="border-b border-[var(--color-border)] bg-[var(--color-surface)] backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-medium text-[var(--color-foreground)]">
              Job Finder
            </Link>
            <div className="flex items-center gap-8">
              <NavLink href="/jobs">Jobs</NavLink>
              <NavLink href="/settings">Einstellungen</NavLink>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <section className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-3xl font-light text-[var(--color-foreground)] mb-2">
              Resume
            </h1>
            <p className="text-[var(--color-primary-soft)]">
              {resume ? 'Dein Lebenslauf' : 'Erstelle deinen ersten Resume'}
            </p>
          </div>
          {!editing && resume && (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center justify-center px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-[var(--color-surface)] rounded-xl font-medium transition-colors"
            >
              Bearbeiten
            </button>
          )}
        </section>

        {/* Resume Card */}
        <section className="bg-[var(--color-surface)] rounded-2xl p-10 border border-[var(--color-border)] shadow-sm mb-8">
          {!resume && !editing ? (
            <div className="text-center py-16">
              <p className="text-[var(--color-primary-soft)] mb-6">
                Noch kein Resume vorhanden.
              </p>
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center justify-center px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-[var(--color-surface)] rounded-xl font-medium transition-colors"
              >
                Resume erstellen
              </button>
            </div>
          ) : editing ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-[var(--color-foreground)] mb-3">
                  Resume Inhalt (Markdown)
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={24}
                  className="w-full px-5 py-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] font-mono text-sm leading-relaxed placeholder:text-[var(--color-primary-soft)] focus:border-[var(--color-accent)] focus:outline-none resize-none"
                  placeholder="# Mein Resume

## Erfahrung
### Senior Developer bei Firma (2020–2024)
• Projekt X geleitet
• Technology Y implementiert

## Skills
• JavaScript, TypeScript
• React, Next.js
• Python, Go"
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={saveResume}
                  disabled={loading}
                  className="inline-flex items-center justify-center px-8 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-[var(--color-surface)] rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? 'Wird gespeichert...' : 'Speichern'}
                </button>
                <button
                  onClick={() => {
                    setEditing(false)
                    setContent(resume?.content || '')
                  }}
                  className="inline-flex items-center justify-center px-8 py-3 bg-[var(--color-border-soft)] hover:bg-[var(--color-border)] text-[var(--color-foreground)] rounded-xl font-medium transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <div className="prose prose-lg max-w-none">
              <div className="whitespace-pre-wrap text-[var(--color-foreground)] leading-relaxed">
                {content}
              </div>
            </div>
          )}
        </section>

        {/* Tip */}
        {resume && !editing && (
          <section className="bg-[var(--color-success)]/10 rounded-2xl p-6 border border-[var(--color-success)]/20">
            <h3 className="font-medium text-[var(--color-success)] mb-2">
              💡 Tipp
            </h3>
            <p className="text-[var(--color-foreground)] text-sm leading-relaxed">
              Dein Resume wird verwendet, um Jobs zu bewerten. Je mehr Details du hast (Skills, Erfahrung, Projekte),
              desto besser die KI-Matches.
            </p>
          </section>
        )}
      </main>
    </div>
  )
}

function NavLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="text-[var(--color-primary-soft)] hover:text-[var(--color-foreground)] text-sm font-medium transition-colors"
    >
      {children}
    </Link>
  )
}
