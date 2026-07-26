'use client'

import { useEffect, useRef, useState } from 'react'

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

interface Insights {
  strengths: { name: string; starExample: string }[]
  weaknesses: { name: string; mitigation: string }[]
  miniTask: {
    task: string
    answer: string
    assessment: string
    scores: { correctness: number; reasoning: number; completeness: number }
  } | null
  competencies: Record<string, number>
  summary: string
}

interface InterviewState {
  id: string
  status: string
  completedItems: string[]
  guide: GuideItem[]
  messages: Message[]
  insights: Insights | null
  personalityType: string | null
}

const COMPETENCY_LABELS: Record<string, string> = {
  teamwork: 'Teamwork',
  communication: 'Kommunikation',
  problemSolving: 'Problemlösung',
  selfReflection: 'Selbstreflexion',
}

export default function InterviewPage() {
  const [interview, setInterview] = useState<InterviewState | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [personalityType, setPersonalityType] = useState('')
  const [savedType, setSavedType] = useState<string | null>(null)
  const [showGuide, setShowGuide] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/interview')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setInterview(data)
        setSavedType(data?.personalityType ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [interview?.messages.length])

  async function startInterview() {
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/interview', { method: 'POST' })
      if (res.ok) setInterview(await res.json())
      else setError('Interview konnte nicht gestartet werden')
    } catch {
      setError('Interview konnte nicht gestartet werden')
    } finally {
      setSending(false)
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    const message = input.trim()
    if (!message || sending) return

    // Optimistisch anzeigen
    setInterview((prev) =>
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
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const data = await res.json()
      if (res.ok) {
        setInterview(data)
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

  async function restart() {
    setSending(true)
    try {
      await fetch('/api/interview', { method: 'DELETE' })
      setInterview(null)
    } finally {
      setSending(false)
    }
  }

  async function savePersonalityType(e: React.FormEvent) {
    e.preventDefault()
    const type = personalityType.trim().toUpperCase()
    if (!type) return
    try {
      const res = await fetch('/api/interview/personality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      const data = await res.json()
      if (res.ok) {
        setSavedType(data.personalityType)
        setPersonalityType('')
      } else {
        setError(data.error || 'Typ konnte nicht gespeichert werden')
      }
    } catch {
      setError('Typ konnte nicht gespeichert werden')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <p className="text-[var(--color-primary-soft)]">Lade Interview...</p>
      </div>
    )
  }

  const isActive = interview?.status === 'ACTIVE'
  const isCompleted = interview?.status === 'COMPLETED' && interview.insights

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <main className="max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <section className="mb-12">
          <h1 className="text-3xl font-light text-[var(--color-foreground)] mb-3">
            HR-Interview
          </h1>
          <p className="text-lg text-[var(--color-primary-soft)]">
            Ein geführtes, strukturiertes Interview erhebt deine Stärken und Schwächen mit
            konkreten Beispielen — als Ergänzung zu deiner Bewerbungs-Akte.
          </p>
        </section>

        {error && (
          <section className="mb-8 p-4 bg-[var(--color-error)]/10 rounded-xl border border-[var(--color-error)]/20">
            <p className="text-sm text-[var(--color-error)]">{error}</p>
          </section>
        )}

        {/* 16Personalities CTA — immer sichtbar */}
        <section className="bg-[var(--color-surface)] rounded-2xl p-8 border border-[var(--color-border)] shadow-sm mb-8">
          <h2 className="text-lg font-medium text-[var(--color-foreground)] mb-2">
            Ergänze deine Akte: 16Personalities
          </h2>
          <p className="text-sm text-[var(--color-primary-soft)] mb-4">
            Mache den kostenlosen Test (ca. 10 Minuten) und trage deinen Typ hier ein.
            Hinweis: Der Test ist ein Selbstbild, keine wissenschaftliche Auswahl-Diagnostik —
            er liefert vor allem gutes Vokabular für deine Selbstbeschreibung.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <a
              href="https://www.16personalities.com/de"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-[var(--color-surface)] rounded-xl font-medium transition-colors"
            >
              Test starten →
            </a>
            <form onSubmit={savePersonalityType} className="flex gap-2 flex-1">
              <input
                type="text"
                value={personalityType}
                onChange={(e) => setPersonalityType(e.target.value)}
                placeholder={savedType ? `Gespeichert: ${savedType}` : 'z.B. INFJ-T'}
                maxLength={6}
                className="flex-1 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] placeholder:text-[var(--color-primary-soft)] focus:border-[var(--color-accent)] focus:outline-none"
              />
              <button
                type="submit"
                className="px-5 py-3 bg-[var(--color-border-soft)] hover:bg-[var(--color-border)] text-[var(--color-foreground)] rounded-xl font-medium transition-colors"
              >
                Speichern
              </button>
            </form>
          </div>
          {savedType && (
            <p className="text-sm text-[var(--color-success)] mt-3">
              ✓ Dein Typ {savedType} ist in deiner Akte hinterlegt.
            </p>
          )}
        </section>

        {/* Intro / Start */}
        {!isActive && !isCompleted && (
          <section className="bg-[var(--color-surface)] rounded-2xl p-16 text-center border border-[var(--color-border)]">
            <p className="text-[var(--color-primary-soft)] mb-2">
              Bereit? Das Interview dauert etwa 15–20 Minuten.
            </p>
            <p className="text-sm text-[var(--color-primary-soft)] mb-6">
              Ein freies Gespräch wie ein echtes HR-Interview. Im Hintergrund hakt die
              Interviewerin ihre Agenda ab — Stärken, Schwächen, Teamverhalten, eine kleine
              Praxisaufgabe, deine Ziele — sobald du einen Punkt befriedigend beantwortet hast.
              Du kannst jederzeit pausieren.
            </p>
            <button
              onClick={startInterview}
              disabled={sending}
              className="inline-flex items-center justify-center px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-[var(--color-surface)] rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              {sending ? 'Starte…' : 'Interview starten'}
            </button>
          </section>
        )}

        {/* Chat */}
        {isActive && interview && (
          <section className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
            {/* Fortschritt: abgehakte Agenda-Punkte */}
            <div className="px-8 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <button
                onClick={() => setShowGuide((v) => !v)}
                className="text-sm text-[var(--color-primary-soft)] hover:text-[var(--color-foreground)] transition-colors"
              >
                {interview.completedItems.length} von {interview.guide.length} Themen abgehakt{' '}
                <span className="text-xs">{showGuide ? '▲' : '▼'}</span>
              </button>
              <button
                onClick={restart}
                className="text-sm text-[var(--color-primary-soft)] hover:text-[var(--color-error)] transition-colors"
              >
                Neu starten
              </button>
            </div>
            <div className="h-1 bg-[var(--color-border-soft)]">
              <div
                className="h-1 bg-[var(--color-primary)] transition-all"
                style={{ width: `${(interview.completedItems.length / Math.max(interview.guide.length, 1)) * 100}%` }}
              />
            </div>
            {showGuide && (
              <div className="px-8 py-4 border-b border-[var(--color-border)] space-y-3">
                {Object.entries(
                  interview.guide.reduce<Record<string, GuideItem[]>>((acc, item) => {
                    ;(acc[item.category] ??= []).push(item)
                    return acc
                  }, {})
                ).map(([category, items]) => (
                  <div key={category}>
                    <p className="text-xs font-medium text-[var(--color-primary-soft)] mb-1">{category}</p>
                    <ul className="space-y-1">
                      {items.map((item) => (
                        <li key={item.id} className="flex items-center gap-2 text-sm">
                          <span className={item.done ? 'text-[var(--color-success)]' : 'text-[var(--color-border)]'}>
                            {item.done ? '✓' : '○'}
                          </span>
                          <span className={item.done ? 'text-[var(--color-primary-soft)] line-through' : 'text-[var(--color-foreground)]'}>
                            {item.topic}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {/* Nachrichten */}
            <div className="p-8 space-y-4 max-h-[55vh] overflow-y-auto">
              {interview.messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-[var(--color-primary)] text-[var(--color-surface)]'
                        : 'bg-[var(--color-border-soft)] text-[var(--color-foreground)]'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl px-5 py-3 text-sm bg-[var(--color-border-soft)] text-[var(--color-primary-soft)]">
                    …
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Eingabe */}
            <form onSubmit={sendMessage} className="px-8 py-4 border-t border-[var(--color-border)] flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Deine Antwort…"
                disabled={sending}
                className="flex-1 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] placeholder:text-[var(--color-primary-soft)] focus:border-[var(--color-accent)] focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-[var(--color-surface)] rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                Senden
              </button>
            </form>
          </section>
        )}

        {/* Ergebnis / Akte */}
        {isCompleted && interview.insights && (
          <section className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-medium text-[var(--color-foreground)]">Deine Akte</h2>
              <button
                onClick={restart}
                className="text-sm text-[var(--color-primary)] hover:text-[var(--color-accent)] transition-colors"
              >
                Neues Interview starten
              </button>
            </div>

            {interview.insights.summary && (
              <div className="bg-[var(--color-surface)] rounded-2xl p-8 border border-[var(--color-border)] shadow-sm">
                <p className="text-sm font-medium text-[var(--color-foreground)] mb-2">Gesamteindruck</p>
                <p className="text-sm text-[var(--color-primary-soft)] leading-relaxed">
                  {interview.insights.summary}
                </p>
              </div>
            )}

            {interview.insights.strengths.length > 0 && (
              <div className="bg-[var(--color-surface)] rounded-2xl p-8 border border-[var(--color-border)] shadow-sm">
                <p className="text-sm font-medium text-[var(--color-foreground)] mb-4">Stärken mit Belegen</p>
                <div className="space-y-4">
                  {interview.insights.strengths.map((s, i) => (
                    <div key={i} className="p-4 bg-[var(--color-success)]/10 rounded-xl border border-[var(--color-success)]/20">
                      <p className="text-sm font-medium text-[var(--color-success)] mb-1">{s.name}</p>
                      <p className="text-sm text-[var(--color-foreground)]">{s.starExample}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {interview.insights.weaknesses.length > 0 && (
              <div className="bg-[var(--color-surface)] rounded-2xl p-8 border border-[var(--color-border)] shadow-sm">
                <p className="text-sm font-medium text-[var(--color-foreground)] mb-4">Entwicklungsfelder</p>
                <div className="space-y-4">
                  {interview.insights.weaknesses.map((w, i) => (
                    <div key={i} className="p-4 bg-[var(--color-warning)]/10 rounded-xl border border-[var(--color-warning)]/20">
                      <p className="text-sm font-medium text-[var(--color-warning)] mb-1">{w.name}</p>
                      <p className="text-sm text-[var(--color-foreground)]">Gegenmaßnahme: {w.mitigation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {interview.insights.miniTask && (
              <div className="bg-[var(--color-surface)] rounded-2xl p-8 border border-[var(--color-border)] shadow-sm">
                <p className="text-sm font-medium text-[var(--color-foreground)] mb-4">Praxisaufgabe</p>
                <p className="text-sm text-[var(--color-primary-soft)] mb-2">
                  <span className="font-medium text-[var(--color-foreground)]">Aufgabe:</span> {interview.insights.miniTask.task}
                </p>
                <p className="text-sm text-[var(--color-primary-soft)] mb-4">
                  <span className="font-medium text-[var(--color-foreground)]">Bewertung:</span> {interview.insights.miniTask.assessment}
                </p>
                <div className="flex flex-wrap gap-2">
                  <ScoreChip label="Korrektheit" value={interview.insights.miniTask.scores.correctness} />
                  <ScoreChip label="Begründung" value={interview.insights.miniTask.scores.reasoning} />
                  <ScoreChip label="Vollständigkeit" value={interview.insights.miniTask.scores.completeness} />
                </div>
              </div>
            )}

            {Object.keys(interview.insights.competencies).length > 0 && (
              <div className="bg-[var(--color-surface)] rounded-2xl p-8 border border-[var(--color-border)] shadow-sm">
                <p className="text-sm font-medium text-[var(--color-foreground)] mb-4">Kompetenz-Profil</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(interview.insights.competencies).map(([key, value]) => (
                    <ScoreChip key={key} label={COMPETENCY_LABELS[key] ?? key} value={value} />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

function ScoreChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--color-border)] bg-[var(--color-border-soft)] text-[var(--color-foreground)]">
      {label}: {value}/5
    </span>
  )
}
