'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '../../components/Toast'

export default function NewJobPage() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [url, setUrl] = useState('')
  const [manualMode, setManualMode] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      url: formData.get('url') as string,
      title: formData.get('title') as string,
      company: formData.get('company') as string,
      location: formData.get('location') as string,
      description: formData.get('description') as string,
    }

    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        router.push('/jobs')
      } else {
        const data = await response.json().catch(() => ({}))
        toast.error(data.error || 'Fehler beim Hinzufügen des Jobs')
      }
    } catch (error) {
      toast.error('Fehler: ' + error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <main className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-light text-[var(--color-foreground)] mb-2">
          Job hinzufügen
        </h1>
        <p className="text-[var(--color-primary-soft)] mb-8">
          Per URL automatisch extrahieren oder manuell eingeben.
        </p>

        <div className="bg-[var(--color-surface)] rounded-2xl p-8 border border-[var(--color-border)] shadow-sm">
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setManualMode(false)}
              className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                !manualMode
                  ? 'bg-[var(--color-primary)] text-[var(--color-surface)]'
                  : 'bg-[var(--color-border-soft)] text-[var(--color-foreground)] hover:bg-[var(--color-border)]'
              }`}
            >
              Per URL
            </button>
            <button
              onClick={() => setManualMode(true)}
              className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                manualMode
                  ? 'bg-[var(--color-primary)] text-[var(--color-surface)]'
                  : 'bg-[var(--color-border-soft)] text-[var(--color-foreground)] hover:bg-[var(--color-border)]'
              }`}
            >
              Manuell
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!manualMode ? (
              <div>
                <label className="block text-sm font-medium text-[var(--color-foreground)] mb-2">
                  Job URL
                </label>
                <input
                  type="url"
                  name="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.indeed.de/jobs/..."
                  className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--background)] text-[var(--color-foreground)] placeholder:text-[var(--color-primary-soft)] focus:border-[var(--color-accent)] focus:outline-none"
                  required
                />
                <p className="text-sm text-[var(--color-primary-soft)] mt-2">
                  Wir versuchen, die Details automatisch zu extrahieren.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-foreground)] mb-2">
                    Job Titel *
                  </label>
                  <input
                    type="text"
                    name="title"
                    placeholder="z.B. Senior Software Engineer"
                    className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--background)] text-[var(--color-foreground)] placeholder:text-[var(--color-primary-soft)] focus:border-[var(--color-accent)] focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-foreground)] mb-2">
                    Firma *
                  </label>
                  <input
                    type="text"
                    name="company"
                    placeholder="z.B. Google"
                    className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--background)] text-[var(--color-foreground)] placeholder:text-[var(--color-primary-soft)] focus:border-[var(--color-accent)] focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-foreground)] mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    name="location"
                    placeholder="z.B. Berlin oder Remote"
                    className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--background)] text-[var(--color-foreground)] placeholder:text-[var(--color-primary-soft)] focus:border-[var(--color-accent)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-foreground)] mb-2">
                    Beschreibung *
                  </label>
                  <textarea
                    name="description"
                    rows={6}
                    placeholder="Füge die vollständige Job-Beschreibung hier ein..."
                    className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--background)] text-[var(--color-foreground)] placeholder:text-[var(--color-primary-soft)] focus:border-[var(--color-accent)] focus:outline-none resize-none"
                    required
                  />
                </div>
              </>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-[var(--color-primary)] hover:bg-[var(--color-accent)] disabled:opacity-50 text-[var(--color-surface)] py-3 rounded-xl font-medium transition-colors"
              >
                {loading ? 'Wird hinzugefügt...' : 'Hinzufügen'}
              </button>
              <Link
                href="/jobs"
                className="px-6 py-3 bg-[var(--color-border-soft)] hover:bg-[var(--color-border)] text-[var(--color-foreground)] rounded-xl font-medium transition-colors"
              >
                Abbrechen
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
