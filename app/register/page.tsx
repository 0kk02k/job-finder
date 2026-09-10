'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Registrierung fehlgeschlagen')
        setLoading(false)
        return
      }

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Account erstellt, aber Login fehlgeschlagen. Bitte manuell anmelden.')
        setLoading(false)
      } else {
        router.push('/')
        router.refresh()
      }
    } catch {
      setError('Ein Fehler ist aufgetreten')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-light text-foreground mb-2 text-center">
          Account erstellen
        </h1>
        <p className="text-primary-soft text-center mb-8">
          Starte deine intelligente Jobsuche
        </p>

        <form onSubmit={handleSubmit} className="bg-surface rounded-2xl p-6 shadow-sm border border-border space-y-4">
          {error && (
            <div role="alert" className="bg-error/10 text-error text-sm p-3 rounded-xl border border-error/20">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Name (optional)
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground"
              />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              E-Mail
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-2 w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground"
              />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Passwort
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="mt-2 w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground"
              />
            </label>
            <p className="text-xs text-primary-soft mt-2">Mindestens 6 Zeichen.</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-strong disabled:opacity-50 text-on-accent py-3 rounded-xl font-medium transition-colors"
          >
            {loading ? 'Wird erstellt …' : 'Registrieren'}
          </button>
        </form>

        <p className="text-center text-sm text-primary-soft mt-4">
          Schon ein Account?{' '}
          <Link href="/login" className="text-primary hover:text-selection transition-colors">
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  )
}
