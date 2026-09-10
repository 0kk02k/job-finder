'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

const links = [
  { href: '/search', label: 'Suchen' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/applications', label: 'Bewerbungen' },
  { href: '/interview', label: 'Interview' },
  { href: '/resume', label: 'Lebenslauf' },
  { href: '/settings', label: 'Einstellungen' },
]

function linkClasses(active: boolean) {
  return `text-sm font-medium transition-colors ${
    active
      // „Wo bin ich" ist Zustand — die Unterlinie trägt Tinten-Blau, nicht Ocker
      ? 'text-foreground underline decoration-selection decoration-2 underline-offset-8'
      : 'text-primary-soft hover:text-foreground'
  }`
}

export function Nav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  if (pathname === '/login' || pathname === '/register') return null

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
          <Link href="/" className="text-xl font-medium text-foreground">
            Job-Finder
          </Link>

          {/* Desktop links */}
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
              className="text-primary-soft hover:text-foreground text-sm font-medium transition-colors"
            >
              Abmelden
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

      {/* Mobile menu panel — Tap-Targets ≥ 40px (WCAG 2.5.8) */}
      {open && (
        <div className="sm:hidden border-t border-border-soft px-6 py-4 flex flex-col gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              aria-current={pathname.startsWith(link.href) ? 'page' : undefined}
              className={`py-2.5 ${linkClasses(pathname.startsWith(link.href))}`}
            >
              {link.label}
            </Link>
          ))}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-left py-2.5 text-primary-soft hover:text-foreground text-sm font-medium transition-colors"
          >
            Abmelden
          </button>
        </div>
      )}
    </nav>
  )
}
