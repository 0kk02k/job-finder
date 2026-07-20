import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { z } from 'zod'

// Whitelist of updatable settings fields. Unknown keys (id, userId, ...) are stripped —
// deliberately not .strict(), because the settings UI sends back the full object incl. id.
const settingsSchema = z.object({
  geminiApiKey: z.string().nullable(),
  openaiApiKey: z.string().nullable(),
  mistralApiKey: z.string().nullable(),
  openrouterApiKey: z.string().nullable(),
  apifyApiKey: z.string().nullable(),
  ollamaUrl: z.string().nullable(),
  aiProvider: z.string(),
  aiModel: z.string().nullable(),
  targetTitles: z.string().nullable(),
  targetLocations: z.string().nullable(),
  minSalary: z.number().int().nullable(),
  remote: z.boolean(),
}).partial()

// GET /api/settings - get user settings
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  let settings = await prisma.userSettings.findUnique({
    where: { userId },
  })

  // Create default settings if not exist
  if (!settings) {
    settings = await prisma.userSettings.create({
      data: { userId },
    })
  }

  return NextResponse.json(settings)
}

// PUT /api/settings - update settings
export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id
  const body = await request.json()

  const parsed = settingsSchema.safeParse(body)
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join('.')
    return NextResponse.json(
      { error: field ? `Ungültiger Wert für Feld "${field}"` : 'Ungültige Einstellungen' },
      { status: 400 }
    )
  }

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: parsed.data,
    create: { userId, ...parsed.data },
  })

  return NextResponse.json(settings)
}
