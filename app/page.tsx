'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Job {
  status: string
  score: number | null
}

export default function Dashboard() {
  const [stats, setStats] = useState<{ total: number; highMatches: number; applied: number } | null>(null)

  useEffect(() => {
    async function loadStats() {
      try {
        const response = await fetch('/api/jobs')
        if (!response.ok) return
        const jobs = await response.json()
        if (!Array.isArray(jobs)) return
        setStats({
          total: jobs.length,
          highMatches: jobs.filter((j: Job) => j.status === 'HIGH_MATCH' || (j.score ?? 0) >= 7).length,
          applied: jobs.filter((j: Job) => ['APPLIED', 'INTERVIEW', 'OFFER'].includes(j.status)).length,
        })
      } catch {
        // Stats bleiben im Ladezustand
      }
    }
    loadStats()
  }, [])

  return (
    <div className="min-h-screen bg-[var(--background)]">

      <main className="max-w-5xl mx-auto px-6 py-16">
        {/* Welcome Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-light text-[var(--color-foreground)] mb-3">
            Willkommen zurück
          </h2>
          <p className="text-lg text-[var(--color-primary-soft)]">
            Verwalte deine Bewerbungen einfach und strukturiert.
          </p>
        </section>

        {/* Stats Overview */}
        <section className="grid sm:grid-cols-3 gap-6 mb-16">
          <StatCard title="Jobs gefunden" value={stats ? String(stats.total) : '–'} subtitle="Gesamt gespeichert" />
          <StatCard title="Matches" value={stats ? String(stats.highMatches) : '–'} subtitle="High score ≥ 7" />
          <StatCard title="Beworben" value={stats ? String(stats.applied) : '–'} subtitle="Erfolgreich gesendet" />
        </section>

        {/* Getting Started */}
        <section className="bg-[var(--color-surface)] rounded-2xl p-10 border border-[var(--color-border)] shadow-sm">
          <h3 className="text-2xl font-medium text-[var(--color-foreground)] mb-8">
            Erste Schritte
          </h3>
          <div className="space-y-6 mb-10">
            <StepCard step={1} title="Resume hochladen" description="Lade deinen Lebenslauf als PDF oder Markdown hoch" />
            <StepCard step={2} title="Jobs suchen" description="Füge Jobs per URL oder manuell hinzu" />
            <StepCard step={3} title="KI-Matching" description="Lass die KI Jobs bewerten und Matches finden" />
            <StepCard step={4} title="Bewerben" description="Nutze angepasste Resumes und Anschreiben" />
          </div>

          <div className="flex flex-wrap gap-4">
            <PrimaryButton href="/search">Jobs suchen</PrimaryButton>
            <SecondaryButton href="/resume">Resume hochladen</SecondaryButton>
          </div>
        </section>
      </main>
    </div>
  )
}

function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl p-8 border border-[var(--color-border-soft)]">
      <p className="text-sm text-[var(--color-primary-soft)] mb-2">{title}</p>
      <p className="text-4xl font-light text-[var(--color-foreground)] mb-1">{value}</p>
      <p className="text-xs text-[var(--color-primary-soft)]">{subtitle}</p>
    </div>
  )
}

function StepCard({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <div className="flex items-start gap-5">
      <div className="flex-shrink-0 w-9 h-9 bg-[var(--color-primary)] text-[var(--color-surface)] rounded-full flex items-center justify-center text-sm font-medium">
        {step}
      </div>
      <div className="pt-1">
        <h4 className="font-medium text-[var(--color-foreground)] mb-1">{title}</h4>
        <p className="text-sm text-[var(--color-primary-soft)] leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

function PrimaryButton({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-[var(--color-surface)] rounded-xl font-medium transition-colors"
    >
      {children}
    </Link>
  )
}

function SecondaryButton({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center px-6 py-3 bg-[var(--color-border-soft)] hover:bg-[var(--color-border)] text-[var(--color-foreground)] rounded-xl font-medium transition-colors"
    >
      {children}
    </Link>
  )
}
