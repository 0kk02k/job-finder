'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
  appliedAt: string | null
  createdAt: string
}

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (params.id) {
      fetchJob(params.id)
    }
  }, [params.id])

  async function fetchJob(id: string) {
    try {
      const response = await fetch(`/api/jobs/${id}`)
      const data = await response.json()
      setJob(data)
    } catch (error) {
      console.error('Failed to fetch job:', error)
    } finally {
      setLoading(false)
    }
  }

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
        alert('PDF Generierung fehlgeschlagen')
      }
    } catch (error) {
      alert('Fehler: ' + error)
    } finally {
      setDownloading(false)
    }
  }

  function getStatusColor(status: string) {
    const colors = {
      DISCOVERED: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200',
      SCORED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      HIGH_MATCH: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      APPLIED: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      INTERVIEW: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      OFFER: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
      REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      ARCHIVED: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    }
    return colors[status as keyof typeof colors] || colors.DISCOVERED
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-600 dark:text-zinc-400">Lade Job...</p>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-600 dark:text-zinc-400">Job nicht gefunden</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link href="/jobs" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50">
            ← Zurück
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
              {job.title}
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              {job.company} • {job.location}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(job.status)}`}>
            {job.status}
          </span>
        </div>

        {job.score && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {job.score}/10
              </span>
              <span className="text-zinc-600 dark:text-zinc-400">AI Match Score</span>
            </div>
            {job.scoreReason && (
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{job.scoreReason}</p>
            )}
          </div>
        )}

        <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
            Beschreibung
          </h2>
          <div className="prose dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
              {job.description}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
            Aktionen
          </h2>

          <div className="space-y-4">
            <h3 className="font-medium text-zinc-900 dark:text-zinc-50">PDF Export</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <button
                onClick={() => handleDownloadPDF('resume')}
                disabled={downloading}
                className="w-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                📄 Resume PDF
              </button>
              <button
                onClick={() => handleDownloadPDF('coverletter')}
                disabled={downloading}
                className="w-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
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
            className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-50 px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Job auf Plattform ansehen
          </a>
        </div>
      </main>
    </div>
  )
}
