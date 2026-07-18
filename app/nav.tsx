'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

const links = [
  { href: '/search', label: 'Suchen' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/resume', label: 'Resume' },
  { href: '/settings', label: 'Einstellungen' },
]

export function Nav() {
  const pathname = usePathname()

  if (pathname === '/login' || pathname === '/register') return null

  return (
    <nav className="border-b border-[var(--color-border)] bg-[var(--color-surface)] backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-6 py-5">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-medium text-[var(--color-foreground)]">
            Job Finder
          </Link>
          <div className="flex items-center gap-8">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  pathname.startsWith(link.href)
                    ? 'text-[var(--color-foreground)]'
                    : 'text-[var(--color-primary-soft)] hover:text-[var(--color-foreground)]'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-[var(--color-primary-soft)] hover:text-[var(--color-foreground)] text-sm font-medium transition-colors"
            >
              Abmelden
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
