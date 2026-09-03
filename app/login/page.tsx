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
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-light text-foreground mb-2 text-center">
          Job Finder
        </h1>
        <p className="text-primary-soft text-center mb-8">
          Melde dich an, um fortzufahren
        </p>

        <form onSubmit={handleSubmit} className="bg-surface rounded-2xl p-6 shadow-sm border border-border space-y-4">
          {error && (
            <div className="bg-error/10 text-error text-sm p-3 rounded-xl border border-error/20">
              {error}
            </div>
          )}

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
                className="mt-2 w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-strong disabled:opacity-50 text-on-accent py-3 rounded-xl font-medium transition-colors"
          >
            {loading ? 'Wird angemeldet …' : 'Anmelden'}
          </button>
        </form>

        <p className="text-center text-sm text-primary-soft mt-4">
          Noch kein Account?{' '}
          <Link href="/register" className="text-primary hover:text-accent">
            Registrieren
          </Link>
        </p>
      </div>
    </div>
  )
}
