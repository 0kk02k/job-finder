import Link from 'next/link'

// Der Footer ist die ruhige Schmalseite der App: Rechtsseiten und die
// Einstellung haben hier ihren Platz, die Nav-Leiste bleibt der Arbeit
// vorbehalten. Server-Komponente — nichts hier ist interaktiv.
export function Footer() {
  return (
    <footer className="bg-surface border-t border-border mt-auto">
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Job-Finder</p>
          <p className="text-xs text-primary-soft mt-0.5">
            Private Instanz für einen festen Freundeskreis.
          </p>
        </div>
        <nav aria-label="Fußzeile" className="flex items-center gap-x-5 gap-y-2 flex-wrap text-sm text-primary-soft">
          <Link href="/settings" className="hover:text-foreground transition-colors">
            Einstellungen
          </Link>
          <Link href="/impressum" className="hover:text-foreground transition-colors">
            Impressum
          </Link>
          <Link href="/datenschutz" className="hover:text-foreground transition-colors">
            Datenschutz
          </Link>
        </nav>
      </div>
    </footer>
  )
}
