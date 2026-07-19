import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const { email, password, name } = await request.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email und Passwort erforderlich' }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    return NextResponse.json({ error: 'Email bereits registriert' }, { status: 400 })
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  try {
    const user = await prisma.user.create({
      data: { email: normalizedEmail, password: hashedPassword, name: name || null },
    })

    return NextResponse.json({ id: user.id, email: user.email })
  } catch (error) {
    // Unique constraint (race condition with concurrent registrations)
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'Email bereits registriert' }, { status: 409 })
    }
    throw error
  }
}
