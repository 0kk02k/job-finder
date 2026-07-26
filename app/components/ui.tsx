import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary'
type Size = 'md' | 'sm'

const baseClasses =
  'inline-flex items-center justify-center rounded-xl font-medium transition-colors'

const variantClasses: Record<Variant, string> = {
  primary: 'bg-accent hover:bg-accent-strong text-on-accent',
  secondary: 'bg-border-soft hover:bg-border text-foreground',
}

const sizeClasses: Record<Size, string> = {
  md: 'px-6 py-3',
  sm: 'px-4 py-2 text-sm',
}

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md') {
  return `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]}`
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button className={`${buttonClasses(variant, size)} ${className}`} {...props} />
  )
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
}: {
  href: string
  variant?: Variant
  size?: Size
  className?: string
  children: ReactNode
}) {
  return (
    <Link href={href} className={`${buttonClasses(variant, size)} ${className}`}>
      {children}
    </Link>
  )
}

export function Card({
  className = '',
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`bg-surface rounded-2xl border border-border ${className}`}>
      {children}
    </div>
  )
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  DISCOVERED: { label: 'Entdeckt', className: 'bg-border-soft text-foreground border-border' },
  SCORED: { label: 'Bewertet', className: 'bg-border-soft text-foreground border-border' },
  HIGH_MATCH: { label: 'Top Match', className: 'bg-success/10 text-success border-success/20' },
  APPLIED: { label: 'Beworben', className: 'bg-accent-soft/30 text-foreground border-border' },
  INTERVIEW: { label: 'Interview', className: 'bg-warning/10 text-warning border-warning/20' },
  OFFER: { label: 'Angebot', className: 'bg-success/10 text-success border-success/20' },
  REJECTED: { label: 'Abgelehnt', className: 'bg-error/10 text-error border-error/20' },
  ARCHIVED: { label: 'Archiviert', className: 'bg-border-soft text-primary-soft border-border' },
}

export function StatusBadge({ status }: { status: string }) {
  const badge = STATUS_BADGES[status] ?? STATUS_BADGES.DISCOVERED
  return (
    <span className={`px-3 py-1.5 rounded-full text-xs font-medium border ${badge.className}`}>
      {badge.label}
    </span>
  )
}
