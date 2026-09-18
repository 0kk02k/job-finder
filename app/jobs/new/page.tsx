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
        const job = await response.json().catch(() => undefined)
        toast.success('Job hinzugefügt.')
        // Direkt ins Detail: dort erscheint die KI-Bewertung — oder der ehrliche
        // Hinweis, warum (noch) keine da ist
        router.push(job?.id ? `/jobs/${job.id}` : '/jobs')
      } else {
        const err = await response.json().catch(() => ({}))
        toast.error(err.error || 'Fehler beim Hinzufügen des Jobs')
      }
    } catch {
      toast.error('Netzwerkfehler — der Job konnte nicht hinzugefügt werden.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-light text-foreground mb-8">
          Job hinzufügen
        </h1>

        <div className="bg-surface rounded-2xl p-8 border border-border shadow-sm">
          <div className="flex gap-3 mb-6" role="group" aria-label="Eingabemodus wählen">
            <button
              onClick={() => setManualMode(false)}
              aria-pressed={!manualMode}
              className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                !manualMode
                  ? 'bg-selection text-on-selection'
                  : 'bg-border-soft text-foreground hover:bg-border'
              }`}
            >
              Per Link
            </button>
            <button
              onClick={() => setManualMode(true)}
              aria-pressed={manualMode}
              className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                manualMode
                  ? 'bg-selection text-on-selection'
                  : 'bg-border-soft text-foreground hover:bg-border'
              }`}
            >
              Manuell
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!manualMode ? (
              <div>
                <label htmlFor="job-url" className="block text-sm font-medium text-foreground mb-2">
                  Link zur Stellenanzeige
                </label>
                <input
                  id="job-url"
                  type="url"
                  name="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.stepstone.de/..."
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-primary-soft"
                  required
                />
                <p className="text-sm text-primary-soft mt-2">
                  Wir versuchen, die Details automatisch zu extrahieren.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="job-title" className="block text-sm font-medium text-foreground mb-2">
                    Stellentitel *
                  </label>
                  <input
                    id="job-title"
                    type="text"
                    name="title"
                    placeholder="z. B. Mechatroniker, Sozialpädagogin, Data Analyst"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-primary-soft"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="job-company" className="block text-sm font-medium text-foreground mb-2">
                    Firma *
                  </label>
                  <input
                    id="job-company"
                    type="text"
                    name="company"
                    placeholder="z. B. Stadtverwaltung, Caritas, Bosch"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-primary-soft"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="job-location" className="block text-sm font-medium text-foreground mb-2">
                    Ort
                  </label>
                  <input
                    id="job-location"
                    type="text"
                    name="location"
                    placeholder="z. B. Berlin oder Remote"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-primary-soft"
                  />
                </div>

                <div>
                  <label htmlFor="job-description" className="block text-sm font-medium text-foreground mb-2">
                    Beschreibung *
                  </label>
                  <textarea
                    id="job-description"
                    name="description"
                    rows={6}
                    placeholder="Füge die vollständige Stellenbeschreibung hier ein …"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-primary-soft resize-none"
                    required
                  />
                </div>
              </>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-accent hover:bg-accent-strong disabled:opacity-50 text-on-accent py-3 rounded-xl font-medium transition-colors"
              >
                {loading ? 'Wird hinzugefügt …' : 'Hinzufügen'}
              </button>
              <Link
                href="/jobs"
                className="px-6 py-3 bg-border-soft hover:bg-border text-foreground rounded-xl font-medium transition-colors"
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
