import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { sanitizeSkillsInput } from '@/lib/anecdotes'

const STORY_FIELDS = ['title', 'situation', 'action', 'result'] as const

// PATCH /api/anecdotes/[id] — Teilupdate; geleerte Felder sind kein Zustand,
// sondern ein Fehler (eine Geschichte ohne Handlung ist keine).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  const { id } = await params
  const body = (await request.json()) as Record<string, unknown>

  const existing = await prisma.anecdote.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!existing) return NextResponse.json({ error: 'Anekdote nicht gefunden' }, { status: 404 })

  const data: Prisma.AnecdoteUpdateInput = {}
  for (const field of STORY_FIELDS) {
    if (body[field] !== undefined) {
      const value = typeof body[field] === 'string' ? (body[field] as string).trim() : ''
      if (!value) {
        return NextResponse.json({ error: 'Leere Felder sind keine Geschichte.' }, { status: 400 })
      }
      data[field] = value
    }
  }
  if (body.skills !== undefined) data.skills = JSON.stringify(sanitizeSkillsInput(body.skills))

  const anecdote = await prisma.anecdote.update({ where: { id }, data })
  return NextResponse.json(anecdote)
}

// DELETE /api/anecdotes/[id] — endgültig; die Fläche fragt zweistufig nach
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  const { id } = await params
  const existing = await prisma.anecdote.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!existing) return NextResponse.json({ error: 'Anekdote nicht gefunden' }, { status: 404 })
  await prisma.anecdote.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
