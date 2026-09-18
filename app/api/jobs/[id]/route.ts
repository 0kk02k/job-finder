import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { JobStatus, Prisma } from '@prisma/client'
import { appliedAtFor, rejectedAtFor, STATUS_LABELS } from '@/lib/status'

const VALID_STATUSES = Object.values(JobStatus)

// GET /api/jobs/[id] - get single job details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { id } = await params
  const job = await prisma.job.findFirst({
    where: { id, userId: session.user.id },
    include: {
      activities: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!job) {
    return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 })
  }

  return NextResponse.json(job)
}

// PATCH /api/jobs/[id] - Status ändern; optional auch Notiz und Wiedervorlage
// (das Cockpit und die Detailseite teilen sich diesen einen Schreibweg)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { status, notes, followUpAt, undoRejectedAt } = body

  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Ungültiger Status' }, { status: 400 })
  }

  let followUp: Date | null = null
  if (followUpAt !== undefined && followUpAt !== null) {
    followUp = new Date(followUpAt)
    if (isNaN(followUp.getTime())) {
      return NextResponse.json({ error: 'Ungültiges Datum für die Wiedervorlage' }, { status: 400 })
    }
  }
  const hasFollowUp = followUpAt !== undefined

  // Only the owner may modify a job
  const existing = await prisma.job.findFirst({
    where: { id, userId: session.user.id },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 })
  }

  try {
    const data: Prisma.JobUpdateInput = {}
    if (status !== undefined) {
      data.status = status
      // Erster Bewerbungsversand und erste Absage werden festgehalten und nie überschrieben
      data.appliedAt = appliedAtFor(status, existing.appliedAt, new Date())
      data.rejectedAt = rejectedAtFor(status, existing.rejectedAt, new Date())
      // Rückgängig-Flag (nur vom Undo-Toast gesetzt): ein sofort widerrufener
      // Fehlklick auf „Abgelehnt" darf die Absage-Statistik nicht vergiften.
      // rejectedAt wird nur gelöscht, wenn (a) der Rücksprung von REJECTED
      // kommt, (b) der Client verspricht, dass genau dieser Klick das Datum
      // gesetzt hat, und (c) es jung genug ist, um wirklich von diesem Klick
      // zu stammen — ein rejectedAt von früher bleibt unberührt.
      if (
        undoRejectedAt === true &&
        status !== 'REJECTED' &&
        existing.status === 'REJECTED' &&
        existing.rejectedAt &&
        Date.now() - existing.rejectedAt.getTime() < 60_000
      ) {
        data.rejectedAt = null
      }
    }
    if (notes !== undefined) {
      // Eine geleerte Notiz ist eine gelöschte — kein Unsichtbarer Restwert
      data.notes = notes === '' ? null : notes
    }
    if (hasFollowUp) {
      data.followUpAt = followUpAt === null ? null : followUp
    }

    const job = await prisma.job.update({ where: { id }, data })

    // Activity nur beim Statuswechsel — Notizen sind ein lebendiges Feld, kein Ereignis
    if (status !== undefined) {
      await prisma.activity.create({
        data: {
          jobId: id,
          type: 'STATUS_CHANGE',
          description: `Status geändert zu ${STATUS_LABELS[status] ?? status}`,
        },
      })
    }

    return NextResponse.json(job)
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 })
    }
    throw error
  }
}

// DELETE /api/jobs/[id] - Anzeige endgültig entfernen (Aktivitäten kaskadieren)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { id } = await params
  // Only the owner may delete a job
  const existing = await prisma.job.findFirst({
    where: { id, userId: session.user.id },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 })
  }

  await prisma.job.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
