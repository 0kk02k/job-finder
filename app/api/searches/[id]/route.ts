import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

// PATCH /api/searches/[id] - update lastRunAt (or other fields)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { id } = await params

  // Only update if the search belongs to the user
  const existing = await prisma.savedSearch.findFirst({
    where: { id, userId: session.user.id },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Suche nicht gefunden' }, { status: 404 })
  }

  const updated = await prisma.savedSearch.update({
    where: { id },
    data: { lastRunAt: new Date() },
  })

  return NextResponse.json(updated)
}

// DELETE /api/searches/[id] - delete a saved search
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { id } = await params

  const existing = await prisma.savedSearch.findFirst({
    where: { id, userId: session.user.id },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Suche nicht gefunden' }, { status: 404 })
  }

  await prisma.savedSearch.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
