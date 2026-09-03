'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '../../components/Toast'
import { MarkdownContent, normalizeTextContent } from '../../components/Markdown'
import { Button, StatusBadge, buttonClasses, scoreTone } from '../../components/ui'

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

  // Gedämpfte Signale statt Vollfläche — der Score trägt Bedeutung, nicht Deko

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <p className="text-primary-soft">Lade Job...</p>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-primary-soft mb-4">{error || 'Job nicht gefunden'}</p>
          <button
            onClick={() => router.push('/jobs')}
            className="text-sm text-primary hover:text-accent transition-colors"
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
            <h1 className="text-3xl sm:text-4xl font-light text-foreground mb-2">
              {job.title}
            </h1>
            <p className="text-primary">
              {job.company}
              {job.location && (
                <span className="text-primary-soft"> • {job.location}</span>
              )}
            </p>
          </div>
          <StatusBadge status={job.status} />
        </div>

        {job.score && (
          <div className="bg-surface rounded-2xl p-6 border border-border mb-6">
            <div className="flex items-baseline gap-3 mb-3">
              <span className={`text-5xl font-light tabular-nums ${scoreTone(job.score)}`}>
                {job.score}
                <span className="text-2xl text-primary-soft">/10</span>
              </span>
              <span className="text-sm text-primary-soft">AI Match Score</span>
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
                      <p className="text-sm font-medium text-foreground mb-2">Transferable Skills:</p>
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
        )}

        <div className="bg-surface rounded-2xl p-6 border border-border mb-6">
          <h2 className="text-sm font-medium text-primary-soft mb-4">
            Beschreibung
          </h2>
          <div className="prose max-w-none">
            {/* Normalisiert (Entities, Bullets, Absätze) und als Fließtext mit Listen gerendert —
                keine Formatierungsartefakte aus den Job-Börsen-Feeds */}
            <MarkdownContent content={normalizeTextContent(job.description ?? '')} variant="description" />
          </div>
        </div>

        <div className="bg-surface rounded-2xl p-6 border border-border mb-6">
          <h2 className="text-sm font-medium text-primary-soft mb-4">
            Aktionen
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => handleDownloadPDF('resume')}
              disabled={downloading}
            >
              Resume als PDF
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => handleDownloadPDF('coverletter')}
              disabled={downloading}
            >
              Anschreiben als PDF
            </Button>
          </div>
        </div>

        <div className="flex gap-4">
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses('primary')}
          >
            Job auf Plattform ansehen
          </a>
        </div>
      </main>
    </div>
  )
}
