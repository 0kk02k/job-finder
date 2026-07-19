import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

// POST /api/autoapply - apply to a job automatically
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const body = await request.json()
  const { jobId } = body

  if (!jobId) {
    return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
  }

  // Get job details (only own jobs)
  const job = await prisma.job.findFirst({
    where: { id: jobId, userId },
  })

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // Auto-Bewerbung deaktiviert: Die bisherige Implementierung hätte reale Bewerbungen
  // mit hardcodierten Platzhalter-Daten (Max Mustermann, nicht existierender
  // resumePath, Submit ohne Bestätigung) abgeschickt. Erst wieder aktivieren,
  // wenn Identität, Lebenslauf und Submit-Bestätigung sauber gelöst sind.
  return NextResponse.json(
    { error: 'Auto-Bewerbung ist derzeit deaktiviert, bis sie zuverlässig funktioniert.' },
    { status: 501 }
  )
}

// GET /api/autoapply - get auto-apply status/history
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Return recent auto-apply attempts (only own jobs)
  const activities = await prisma.activity.findMany({
    where: { type: 'STATUS_CHANGE', job: { userId: session.user.id } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  return NextResponse.json({ activities })
}
