'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { MarkdownContent } from '../components/Markdown'

interface Message {
  role: 'assistant' | 'user'
  content: string
  ts: string
}

interface GuideItem {
  id: string
  category: string
  topic: string
  criteria: string
  done: boolean
}

interface Profile {
  version: 1
  enjoys: string
  criteria: { topic: string; weight: string; note: string }[]
  avoids: string[]
  growth: string
  summary: string
  keywords: string[]
}

interface ChatState {
  id: string
  status: string
  completedItems: string[]
  guide: GuideItem[]
  messages: Message[]
  profile: Profile | null
}

const WEIGHT_STYLES: Record<string, string> = {
  hoch: 'border-accent/40 bg-accent-soft/30 text-foreground',
  mittel: 'border-border bg-border-soft text-foreground',
  niedrig: 'border-border bg-transparent text-primary-soft',
}

export default function PreferencesPage() {
  const [session, setSession] = useState<ChatState | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [resynthesizing, setResynthesizing] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [showGuide, setShowGuide] = useState(false)
  const [confirmingRestart, setConfirmingRestart] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/preferences')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setSession(data?.session ?? null)
        setProfile(data?.profile ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session?.messages.length])

  async function startChat() {
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/preferences', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setSession(data)
      } else {
        setError(data.error || 'Gespräch konnte nicht gestartet werden')
      }
    } catch {
      setError('Gespräch konnte nicht gestartet werden')
    } finally {
      setSending(false)
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    const message = input.trim()
    if (!message || sending) return

    // Optimistisch anzeigen
    setSession((prev) =>
      prev
        ? {
            ...prev,
            messages: [
              ...prev.messages,
              { role: 'user', content: message, ts: new Date().toISOString() },
            ],
          }
        : prev
    )
    setInput('')
    setSending(true)
    setError(null)

    try {
      const res = await fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const data = await res.json()
      if (res.ok) {
        setSession(data)
      } else {
        setError(data.error || 'Antwort konnte nicht gesendet werden')
        setInput(message) // Eingabe zurückholen
      }
    } catch {
      setError('Antwort konnte nicht gesendet werden')
      setInput(message)
    } finally {
      setSending(false)
    }
  }

  // Synthese fehlgeschlagen (KI kurz weg) — das Transkript ist komplett, also
  // reicht das erneute Ableiten. Kein zweites Gespräch nötig.
  async function resynthesize() {
    setResynthesizing(true)
    setError(null)
    try {
      const res = await fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resynthesize: true }),
      })
      const data = await res.json()
      if (res.ok) {
        setProfile(data.profile)
        if (session && data.profile) setSession({ ...session, profile: data.profile })
      } else {
        setError(data.error || 'Profil konnte nicht erstellt werden')
      }
    } catch {
      setError('Profil konnte nicht erstellt werden')
    } finally {
      setResynthesizing(false)
    }
  }

  // Neu starten löscht ehrliche Antworten — das verdient Reibung.
  async function restart() {
    setConfirmingRestart(false)
    setSending(true)
    try {
      const res = await fetch('/api/preferences', { method: 'DELETE' })
      if (res.ok) {
        setSession(null)
        setError(null)
      } else {
        setError('Neustart fehlgeschlagen — dein Gespräch bleibt unverändert.')
      }
    } catch {
      setError('Neustart fehlgeschlagen — dein Gespräch bleibt unverändert.')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-primary-soft">Lade Präferenz-Gespräch...</p>
      </div>
    )
  }

  const isActive = session?.status === 'ACTIVE'
  const isCompleted = session?.status === 'COMPLETED'
  const currentProfile = profile ?? session?.profile ?? null

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <section className="mb-12">
          <h1 className="text-3xl font-light text-foreground mb-3">
            Präferenz-Gespräch
          </h1>
          <p className="text-lg text-primary-soft">
            Ein kurzes KI-Gespräch klärt, was dir an Arbeit wirklich wichtig ist — das Ergebnis
            fließt in die Bewertung und Suche deiner Jobs ein.
          </p>
        </section>

        {error && (
          <section role="alert" className="mb-8 p-4 bg-error/10 rounded-xl border border-error/20">
            <p className="text-sm text-error">{error}</p>
          </section>
        )}

        {/* Intro / Start */}
        {!isActive && !isCompleted && !currentProfile && (
          <section className="bg-surface rounded-2xl p-16 text-center border border-border">
            <p className="text-primary-soft mb-2">
              Bereit? Das Gespräch dauert etwa 10 Minuten.
            </p>
            <p className="text-sm text-primary-soft mb-6">
              Vier Themen: Was dir Freude macht, wie du Kriterien gewichtest, was du vermeiden
              willst und wohin du dich entwickelst. Die Beraterin hakt die Themen im Hintergrund
              ab, sobald sie sie verstanden hat. Du kannst jederzeit aufhören — dein Stand bleibt
              erhalten, wenn du wiederkommst.
            </p>
            <button
              onClick={startChat}
              disabled={sending}
              className="inline-flex items-center justify-center px-6 py-3 bg-accent hover:bg-accent-strong text-surface rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              {sending ? 'Starte…' : 'Gespräch starten'}
            </button>
          </section>
        )}

        {/* Chat */}
        {isActive && session && (
          <section className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
            {/* Fortschritt: abgehakte Agenda-Themen */}
            <div className="px-8 py-4 border-b border-border flex items-center justify-between gap-3">
              <button
                onClick={() => setShowGuide((v) => !v)}
                aria-expanded={showGuide}
                className="text-sm text-primary-soft hover:text-foreground transition-colors"
              >
                <span className="tabular-nums">
                  {session.completedItems.length} von {session.guide.length} Themen abgehakt
                </span>{' '}
                —{' '}
                <span className="text-xs underline">{showGuide ? 'ausblenden' : 'anzeigen'}</span>
              </button>
              <div className="flex items-center gap-3 flex-shrink-0">
                {confirmingRestart && (
                  <span className="text-xs text-error" role="status">
                    Antworten werden gelöscht.
                  </span>
                )}
                <button
                  onClick={() => {
                    if (confirmingRestart) {
                      void restart()
                    } else {
                      setConfirmingRestart(true)
                      setTimeout(() => setConfirmingRestart(false), 5000)
                    }
                  }}
                  className={`text-sm transition-colors ${
                    confirmingRestart
                      ? 'font-medium text-error'
                      : 'text-primary-soft hover:text-error'
                  }`}
                >
                  {confirmingRestart ? 'Wirklich löschen' : 'Neu starten'}
                </button>
              </div>
            </div>
            <div className="h-1 bg-border-soft">
              <div
                className="h-1 bg-primary transition-all"
                style={{ width: `${(session.completedItems.length / Math.max(session.guide.length, 1)) * 100}%` }}
              />
            </div>
            {showGuide && (
              <div className="px-8 py-4 border-b border-border space-y-3">
                {Object.entries(
                  session.guide.reduce<Record<string, GuideItem[]>>((acc, item) => {
                    ;(acc[item.category] ??= []).push(item)
                    return acc
                  }, {})
                ).map(([category, items]) => (
                  <div key={category}>
                    <p className="text-xs font-medium text-primary-soft mb-1">{category}</p>
                    <ul className="space-y-1">
                      {items.map((item) => (
                        <li key={item.id} className="flex items-center gap-2 text-sm">
                          <span className={item.done ? 'text-success' : 'text-border'}>
                            {item.done ? '✓' : '○'}
                          </span>
                          <span className={item.done ? 'text-primary-soft line-through' : 'text-foreground'}>
                            {item.topic}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {/* Nachrichten — role="log" kündigt neue Beiträge automatisch an */}
            <div
              className="p-8 space-y-4 max-h-[55vh] overflow-y-auto"
              role="log"
              aria-label="Präferenz-Gespräch-Verlauf"
            >
              {session.messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-accent-soft/30 text-foreground border border-accent/20 whitespace-pre-wrap'
                        : 'bg-border-soft text-foreground'
                    }`}
                  >
                    {m.role === 'user' ? m.content : <MarkdownContent content={m.content} variant="chat" />}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start" aria-live="polite">
                  <div className="rounded-2xl px-5 py-3 text-sm bg-border-soft text-primary-soft">
                    Die Beraterin schreibt …
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Eingabe */}
            <form onSubmit={sendMessage} className="px-8 py-4 border-t border-border flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Deine Antwort…"
                disabled={sending}
                className="flex-1 min-w-0 px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-primary-soft disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="px-6 py-3 bg-accent hover:bg-accent-strong text-surface rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                Senden
              </button>
            </form>
          </section>
        )}

        {/* Abschluss ohne Profil — Synthese fehlgeschlagen, ehrlich melden.
            Das Transkript ist komplett: Erneut versuchen, kein zweites Gespräch. */}
        {isCompleted && !currentProfile && (
          <section className="bg-surface rounded-2xl p-16 text-center border border-border">
            <p className="text-foreground mb-2">
              Das Gespräch ist abgeschlossen — aber das Profil konnte nicht erstellt werden.
            </p>
            <p className="text-sm text-primary-soft mb-6">
              Die KI war vermutlich kurz nicht erreichbar. Deine Antworten sind gespeichert.
            </p>
            <button
              onClick={resynthesize}
              disabled={resynthesizing}
              className="inline-flex items-center justify-center px-6 py-3 bg-accent hover:bg-accent-strong text-surface rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              {resynthesizing ? 'Erstelle Profil …' : 'Erneut versuchen'}
            </button>
          </section>
        )}

        {/* Ergebnis: das Profil */}
        {!isActive && currentProfile && (
          <section className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-medium text-foreground">Dein Präferenzen-Profil</h2>
              <Link href="/settings#job-praeferenzen" className="text-sm text-primary hover:text-selection transition-colors">
                In den Einstellungen ansehen
              </Link>
            </div>

            {currentProfile.summary && (
              <div className="bg-surface rounded-2xl p-8 border border-border shadow-sm">
                <p className="text-sm font-medium text-foreground mb-2">Kurz gesagt</p>
                <p className="text-sm text-primary-soft leading-relaxed">{currentProfile.summary}</p>
              </div>
            )}

            {currentProfile.enjoys && (
              <div className="bg-surface rounded-2xl p-8 border border-border shadow-sm">
                <p className="text-sm font-medium text-foreground mb-2">Freude macht dir</p>
                <p className="text-sm text-primary-soft leading-relaxed">{currentProfile.enjoys}</p>
              </div>
            )}

            {currentProfile.criteria.length > 0 && (
              <div className="bg-surface rounded-2xl p-8 border border-border shadow-sm">
                <p className="text-sm font-medium text-foreground mb-4">Gewichtung</p>
                <div className="flex flex-wrap gap-2">
                  {currentProfile.criteria.map((c, i) => (
                    <span
                      key={i}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border ${WEIGHT_STYLES[c.weight] ?? WEIGHT_STYLES.mittel}`}
                      title={c.note || undefined}
                    >
                      {c.topic} · {c.weight}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {currentProfile.avoids.length > 0 && (
              <div className="bg-surface rounded-2xl p-8 border border-border shadow-sm">
                <p className="text-sm font-medium text-foreground mb-3">Meidest du</p>
                <ul className="space-y-1">
                  {currentProfile.avoids.map((a, i) => (
                    <li key={i} className="text-sm text-primary-soft">— {a}</li>
                  ))}
                </ul>
              </div>
            )}

            {currentProfile.growth && (
              <div className="bg-surface rounded-2xl p-8 border border-border shadow-sm">
                <p className="text-sm font-medium text-foreground mb-2">Entwicklung</p>
                <p className="text-sm text-primary-soft leading-relaxed">{currentProfile.growth}</p>
              </div>
            )}

            {!isActive && (
              <div className="pt-2">
                <button
                  onClick={startChat}
                  disabled={sending}
                  className="text-sm text-primary hover:text-selection transition-colors disabled:opacity-50"
                >
                  Gespräch neu führen
                </button>
                <p className="text-xs text-primary-soft mt-2">
                  Ein neues Gespräch überschreibt das Profil — bestehende Job-Bewertungen bleiben unverändert.
                </p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
