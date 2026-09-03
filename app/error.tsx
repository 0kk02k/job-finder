'use client'

import { useEffect } from 'react'
import { Button, ButtonLink } from './components/ui'

// Route-Root-Error-Boundary: fängt Render-Crashes ab, die die Seite selbst nicht
// in ihren Zustands-Meldungen (auth / error / refreshError) behandeln kann.
// Prop-Name `unstable_retry` gemäß Dokumentation dieser Next-Version
// (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md).
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-5xl mx-auto px-6 py-16">
        <section role="alert" className="p-4 bg-error/10 rounded-xl border border-error/20">
          <h1 className="text-lg font-medium text-foreground mb-1">
            Hier ist etwas schiefgelaufen
          </h1>
          <p className="text-sm text-primary mb-3">
            Ein interner Fehler — deine Daten sind unberührt. Versuch es erneut; bleibt es
            bestehen, lade die Seite neu.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button size="sm" variant="secondary" onClick={() => unstable_retry()}>
              Erneut versuchen
            </Button>
            <ButtonLink href="/" variant="secondary" size="sm">
              Zur Startseite
            </ButtonLink>
          </div>
        </section>
      </main>
    </div>
  )
}
