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

  async function handleGoogle() {
    setLoading(true)
    setError('')
    // Derselbe Vertrag wie beim Credentials-Login: redirect:false liefert ein
    // Ergebnis-Objekt statt sofort umzuleiten — ein Fehler oder Abbruch hängt
    // sonst ewig in „Wird angemeldet …"
    try {
      const result = await signIn('google', { callbackUrl: '/', redirect: false })
      if (result?.error) {
        setError('Anmeldung mit Google fehlgeschlagen — versuch es erneut.')
        setLoading(false)
      } else if (result?.url) {
        router.push(result.url)
        router.refresh()
      } else {
        setLoading(false)
      }
    } catch {
      setError('Anmeldung mit Google fehlgeschlagen — versuch es erneut.')
      setLoading(false)
    }
  }

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
    <div className="flex-1 bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Wortmarke dekorativ, die Seite trägt eine echte H1 */}
        <p className="text-xl font-semibold text-foreground mb-2 text-center">
          Job-Finder
        </p>
        <h1 className="text-2xl font-light text-foreground mb-8 text-center">
          Anmelden
        </h1>

        <form onSubmit={handleSubmit} className="bg-surface rounded-2xl p-6 shadow-sm border border-border space-y-4">
          {error && (
            <div role="alert" className="bg-error/10 text-error text-sm p-3 rounded-xl border border-error/20">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
              E-Mail
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-2 w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground"
              />
            </label>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
              Passwort
              <input
                id="password"
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

          <div className="flex items-center gap-3 pt-1">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-primary-soft">oder</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full bg-surface hover:bg-border/40 disabled:opacity-50 border border-border text-foreground py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-3"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 0 0 9 18Z"/>
              <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.32Z"/>
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58Z"/>
            </svg>
            Mit Google anmelden
          </button>
        </form>

        <p className="text-center text-sm text-primary-soft mt-4">
          Noch kein Account?{' '}
          <Link href="/register" className="text-primary hover:text-selection transition-colors">
            Registrieren
          </Link>
        </p>
      </div>
    </div>
  )
}
