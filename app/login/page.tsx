'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('Falsche Email oder Passwort')
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-light text-[var(--color-foreground)] mb-2 text-center">
          Job Finder
        </h1>
        <p className="text-[var(--color-primary-soft)] text-center mb-8">
          Melde dich an, um fortzufahren
        </p>

        <form onSubmit={handleSubmit} className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-sm border border-[var(--color-border)] space-y-4">
          {error && (
            <div className="bg-[var(--color-error)]/10 text-[var(--color-error)] text-sm p-3 rounded-xl border border-[var(--color-error)]/20">
              {error}
            </div>
          )}

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
              className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--background)] text-[var(--color-foreground)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-accent)] disabled:opacity-50 text-[var(--color-surface)] py-3 rounded-xl font-medium transition-colors"
          >
            {loading ? 'Wird angemeldet...' : 'Anmelden'}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--color-primary-soft)] mt-4">
          Noch kein Account?{' '}
          <Link href="/register" className="text-[var(--color-primary)] hover:text-[var(--color-accent)]">
            Registrieren
          </Link>
        </p>
      </div>
    </div>
  )
}
