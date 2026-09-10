import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { PIPELINE_STATUSES, sortApplications, weekStats } from '@/lib/applications'

// GET /api/applications - das Cockpit-Set: laufende Bewerbungen (APPLIED,
// INTERVIEW, OFFER) mit Terminen und Notizen, fällige Wiedervorlagen zuerst,
// plus die Wochen-Kennzahlen. Bewusst schlanke Feldauswahl — die Beschreibung
// bleibt auf /jobs und dem Detail, hier zählt der Überblick.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  const userId = session.user.id

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [pipeline, all] = await Promise.all([
    prisma.job.findMany({
      where: { userId, status: { in: [...PIPELINE_STATUSES] } },
      orderBy: { appliedAt: 'desc' },
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        url: true,
        status: true,
        score: true,
        createdAt: true,
        appliedAt: true,
        followUpAt: true,
        notes: true,
      },
    }),
    // Kennzahlen über den ganzen Bestand — eine Absage der Woche steht nicht
    // mehr in der Pipeline, darf in der Wochen-Zeile aber nicht fehlen
    prisma.job.findMany({
      where: { userId },
      select: { status: true, appliedAt: true, rejectedAt: true },
    }),
  ])

  const iso = (date: Date | null) => date?.toISOString() ?? null

  return NextResponse.json({
    applications: sortApplications(
      pipeline.map((job) => ({
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        url: job.url,
        status: job.status,
        score: job.score,
        createdAt: job.createdAt.toISOString(),
        appliedAt: iso(job.appliedAt),
        followUpAt: iso(job.followUpAt),
        notes: job.notes,
      })),
      now
    ),
    stats: weekStats(
      all.map((job) => ({
        status: job.status,
        appliedAt: iso(job.appliedAt),
        rejectedAt: iso(job.rejectedAt),
      })),
      weekAgo
    ),
  })
}
