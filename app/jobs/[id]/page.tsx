'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '../../components/Toast'

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
  const [downloading, setDownloading] = useState(false)

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

  async function handleDownloadPDF(type: 'resume' | 'coverletter') {
    if (!job) return

    setDownloading(true)
    try {
      const response = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          jobId: job.id,
        }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = type === 'resume' ? 'Resume.pdf' : `Cover_Letter_${job.company}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        toast.error('PDF Generierung fehlgeschlagen')
      }
    } catch (error) {
      toast.error('Fehler: ' + error)
    } finally {
      setDownloading(false)
    }
  }

  function getStatusColor(status: string) {
    const colors: Record<string, string> = {
      DISCOVERED: 'bg-[var(--color-border-soft)] text-[var(--color-foreground)]',
      SCORED: 'bg-[var(--color-border-soft)] text-[var(--color-foreground)]',
      HIGH_MATCH: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
      APPLIED: 'bg-[var(--color-accent-soft)]/30 text-[var(--color-foreground)]',
      INTERVIEW: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
      OFFER: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
      REJECTED: 'bg-[var(--color-error)]/10 text-[var(--color-error)]',
      ARCHIVED: 'bg-[var(--color-border-soft)] text-[var(--color-primary-soft)]',
    }
    return colors[status] || colors.DISCOVERED
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <p className="text-[var(--color-primary-soft)]">Lade Job...</p>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--color-primary-soft)] mb-4">{error || 'Job nicht gefunden'}</p>
          <button
            onClick={() => router.push('/jobs')}
            className="text-sm text-[var(--color-primary)] hover:text-[var(--color-accent)] transition-colors"
          >
            Zurück zur Job-Übersicht
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-medium text-[var(--color-foreground)] mb-2">
              {job.title}
            </h1>
            <p className="text-[var(--color-primary-soft)]">
              {job.company} • {job.location}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(job.status)}`}>
            {job.status}
          </span>
        </div>

        {job.score && (
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] mb-6">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-3xl font-light text-[var(--color-primary)]">
                {job.score}/10
              </span>
              <span className="text-[var(--color-primary-soft)]">AI Match Score</span>
            </div>
            {job.scoreReason && (
              <p className="text-sm text-[var(--color-foreground)]">{job.scoreReason}</p>
            )}
            {(() => {
              const { strengths, gaps, transferableSkills } = parseMatchDetails(job.matchDetails)
              return (
                <>
                  {strengths && strengths.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-[var(--color-foreground)] mb-2">Passt gut:</p>
                      <div className="flex flex-wrap gap-2">
                        {strengths.map((skill, i) => (
                          <span key={i} className="px-3 py-1 bg-[var(--color-success)]/10 text-[var(--color-success)] text-sm rounded-full">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {gaps && gaps.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-[var(--color-foreground)] mb-2">Fehlt:</p>
                      <div className="flex flex-wrap gap-2">
                        {gaps.map((gap, i) => (
                          <span key={i} className="px-3 py-1 bg-[var(--color-error)]/10 text-[var(--color-error)] text-sm rounded-full">
                            {gap}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {transferableSkills && transferableSkills.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-[var(--color-foreground)] mb-2">Transferable Skills:</p>
                      <div className="flex flex-wrap gap-2">
                        {transferableSkills.map((skill, i) => (
                          <span key={i} className="px-3 py-1 bg-[var(--color-border-soft)] text-[var(--color-foreground)] text-sm rounded-full">
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
        )}

        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] mb-6">
          <h2 className="text-lg font-medium text-[var(--color-foreground)] mb-4">
            Beschreibung
          </h2>
          <div className="prose max-w-none">
            <p className="whitespace-pre-wrap text-[var(--color-foreground)] leading-relaxed">
              {job.description}
            </p>
          </div>
        </div>

        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] mb-6">
          <h2 className="text-lg font-medium text-[var(--color-foreground)] mb-4">
            Aktionen
          </h2>

          <div className="space-y-4">
            <h3 className="font-medium text-[var(--color-foreground)]">PDF Export</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <button
                onClick={() => handleDownloadPDF('resume')}
                disabled={downloading}
                className="w-full bg-[var(--color-border-soft)] hover:bg-[var(--color-border)] text-[var(--color-foreground)] px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                📄 Resume PDF
              </button>
              <button
                onClick={() => handleDownloadPDF('coverletter')}
                disabled={downloading}
                className="w-full bg-[var(--color-border-soft)] hover:bg-[var(--color-border)] text-[var(--color-foreground)] px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                ✉️ Anschreiben PDF
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[var(--color-border-soft)] hover:bg-[var(--color-border)] text-[var(--color-foreground)] px-6 py-3 rounded-xl font-medium transition-colors"
          >
            Job auf Plattform ansehen
          </a>
        </div>
      </main>
    </div>
  )
}
