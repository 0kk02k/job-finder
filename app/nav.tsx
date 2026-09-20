'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

const links = [
  { href: '/search', label: 'Suchen' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/applications', label: 'Bewerbungen' },
  { href: '/interview', label: 'Interview' },
  { href: '/resume', label: 'Lebenslauf' },
]

// Die Abmelde-Geste: ein gezogener Strich mit Pfeil nach draußen —
// gezeichnet wie das Menü-Icon (1.5 Stroke), kein Emoji, keine Bibliothek.
function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M7 2.5H4.5A1.5 1.5 0 0 0 3 4v10a1.5 1.5 0 0 0 1.5 1.5H7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 5.5 15 9l-3.5 3.5M15 9H6.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function linkClasses(active: boolean, large = false) {
  return `${large ? 'text-base' : 'text-sm'} font-medium transition-colors ${
    active
      // „Wo bin ich" ist Zustand — die Unterlinie trägt Tinten-Blau, nicht Ocker
      ? 'text-foreground underline decoration-selection decoration-2 underline-offset-8'
      : 'text-primary-soft hover:text-foreground'
  }`
}

// Rechts- und Erklärseiten sind öffentlich (proxy.ts) — für anonyme Besucher
// ist die App-Nav ein Irrweg: jeder Link landet im Login-Redirect. Die
// Public-Nav kennt nur Wortmarke und Anmelden.
const PUBLIC_PAGES = ['/so-funktionierts', '/impressum', '/datenschutz']

export function Nav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const { status } = useSession()

  if (pathname === '/login' || pathname === '/register') return null

  // Eingeloggte Nutzer behalten die volle Nav, auch auf den Public-Seiten
  if (PUBLIC_PAGES.includes(pathname) && status !== 'authenticated') {
    return (
      <nav className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <a
          href="#inhalt"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-accent"
        >
          Zum Inhalt springen
        </a>
        <div className="max-w-5xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-semibold text-foreground">
              Job-Finder
            </Link>
            <Link
              href="/login"
              aria-current={pathname === '/login' ? 'page' : undefined}
              className={linkClasses(false)}
            >
              Anmelden
            </Link>
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
      {/* Skip-Link: der erste Tab-Stop springt über die komplette Navigation */}
      <a
        href="#inhalt"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-accent"
      >
        Zum Inhalt springen
      </a>
      <div className="max-w-5xl mx-auto px-6 py-5">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-semibold text-foreground">
            Job-Finder
          </Link>

          {/* Desktop links — Einstellungen leben im Footer, Abmelden ist eine Geste */}
          <div className="hidden sm:flex items-center gap-8">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname.startsWith(link.href) ? 'page' : undefined}
                className={linkClasses(pathname.startsWith(link.href))}
              >
                {link.label}
              </Link>
            ))}
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              aria-label="Abmelden"
              title="Abmelden"
              className="flex items-center justify-center w-10 h-10 -mr-2 rounded-xl text-primary-soft hover:text-foreground hover:bg-border-soft transition-colors"
            >
              <LogoutIcon />
            </button>
          </div>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-label={open ? 'Menü schließen' : 'Menü öffnen'}
            className="sm:hidden flex items-center justify-center w-10 h-10 rounded-xl text-foreground hover:bg-border-soft transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              {open ? (
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              ) : (
                <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu panel — rechtsbündig unter dem Toggle, eine Stufe größer
          als die Desktop-Labels (Daumen-Ziel), Tap-Targets ≥ 40px (WCAG 2.5.8) */}
      {open && (
        <div className="sm:hidden border-t border-border-soft px-6 py-4 flex flex-col items-end gap-1 text-right">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              aria-current={pathname.startsWith(link.href) ? 'page' : undefined}
              className={`py-2.5 ${linkClasses(pathname.startsWith(link.href), true)}`}
            >
              {link.label}
            </Link>
          ))}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-3 text-right py-2.5 text-primary-soft hover:text-foreground text-base font-medium transition-colors"
          >
            <LogoutIcon />
            Abmelden
          </button>
        </div>
      )}
    </nav>
  )
}
