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
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-light text-[var(--color-foreground)] mb-2 text-center">
          Account erstellen
        </h1>
        <p className="text-[var(--color-primary-soft)] text-center mb-8">
          Starte deine intelligente Jobsuche
        </p>

        <form onSubmit={handleSubmit} className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-sm border border-[var(--color-border)] space-y-4">
          {error && (
            <div className="bg-[var(--color-error)]/10 text-[var(--color-error)] text-sm p-3 rounded-xl border border-[var(--color-error)]/20">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--color-foreground)] mb-2">
              Name (optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--background)] text-[var(--color-foreground)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-foreground)] mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--background)] text-[var(--color-foreground)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-foreground)] mb-2">
              Passwort
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--background)] text-[var(--color-foreground)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-accent)] disabled:opacity-50 text-[var(--color-surface)] py-3 rounded-xl font-medium transition-colors"
          >
            {loading ? 'Wird erstellt...' : 'Registrieren'}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--color-primary-soft)] mt-4">
          Schon ein Account?{' '}
          <Link href="/login" className="text-[var(--color-primary)] hover:text-[var(--color-accent)]">
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  )
}
