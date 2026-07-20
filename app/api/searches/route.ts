import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

// GET /api/searches - list saved searches for the user
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const searches = await prisma.savedSearch.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(searches)
}

// POST /api/searches - create a new saved search
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const body = await request.json()
  const { query, location, remote, semantic } = body

  if (!query || typeof query !== 'string') {
    return NextResponse.json({ error: 'Suchbegriff erforderlich' }, { status: 400 })
  }

  try {
    const savedSearch = await prisma.savedSearch.upsert({
      where: {
        userId_query_location: {
          userId: session.user.id,
          query,
          location: location || '',
        },
      },
      update: {
        remote: Boolean(remote),
        semantic: semantic !== false,
      },
      create: {
        userId: session.user.id,
        query,
        location: location || null,
        remote: Boolean(remote),
        semantic: semantic !== false,
      },
    })

    return NextResponse.json(savedSearch)
  } catch (error) {
    console.error('Failed to save search:', error)
    return NextResponse.json({ error: 'Suche konnte nicht gespeichert werden' }, { status: 500 })
  }
}
