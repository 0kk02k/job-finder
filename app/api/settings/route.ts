import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { z } from 'zod'

// Whitelist of updatable settings fields. Unknown keys (id, userId, ...) are stripped —
// deliberately not .strict(), because the settings UI sends back the full object incl. id.
const settingsSchema = z.object({
  geminiApiKey: z.string().nullable(),
  openaiApiKey: z.string().nullable(),
  nebiusApiKey: z.string().nullable(),
  openrouterApiKey: z.string().nullable(),
  apifyApiKey: z.string().nullable(),
  joobleApiKey: z.string().nullable(),
  adzunaAppId: z.string().nullable(),
  adzunaAppKey: z.string().nullable(),
  ollamaUrl: z.string().nullable(),
  aiProvider: z.string(),
  aiModel: z.string().nullable(),
  docTemplate: z.enum(['modern', 'klassisch', 'kompakt']),
  targetTitles: z.string().nullable(),
  targetLocations: z.string().nullable(),
  minSalary: z.number().int().nullable(),
  remote: z.boolean(),
}).partial()

// GET liefert API-Keys nie im Klartext — nur einen Maskiert-Hinweis („••••4f2a“).
// Ein neuer Key wird gesetzt, indem man ihn eintippt; leer lassen heißt behalten.
const KEY_FIELDS = ['geminiApiKey', 'openaiApiKey', 'nebiusApiKey', 'openrouterApiKey', 'apifyApiKey', 'joobleApiKey', 'adzunaAppId', 'adzunaAppKey'] as const

function maskKey(value: string | null | undefined): string | null {
  if (!value) return null
  return `••••${value.slice(-4)}`
}

// GET /api/settings - get user settings (Keys maskiert)
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

  const {
    geminiApiKey: _g, openaiApiKey: _o, nebiusApiKey: _n, openrouterApiKey: _r,
    apifyApiKey: _a, joobleApiKey: _j, adzunaAppId: _ai, adzunaAppKey: _ak,
    ...rest
  } = settings
  return NextResponse.json({
    ...rest,
    geminiKeyHint: maskKey(_g),
    openaiKeyHint: maskKey(_o),
    nebiusKeyHint: maskKey(_n),
    openrouterKeyHint: maskKey(_r),
    apifyKeyHint: maskKey(_a),
    joobleKeyHint: maskKey(_j),
    adzunaAppIdHint: maskKey(_ai),
    adzunaAppKeyHint: maskKey(_ak),
  })
}

// PUT /api/settings - update settings.
// Key-Felder gelten nur, wenn der Client einen nicht-leeren NEUEN Wert schickt.
// `null` bedeutet ausdrücklich „unverändert“ — nach dem Maskiert-GET kann ein
// null sonst nur versehentlich sein und würde den gespeicherten Key löschen.
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

  const data = { ...parsed.data }
  for (const key of KEY_FIELDS) {
    if (data[key] != null && typeof data[key] === 'string' && (data[key] as string).trim() === '') {
      delete data[key]
    }
    if (data[key] === null) {
      delete data[key]
    }
  }

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  })

  return NextResponse.json({
    ...settings,
    geminiApiKey: undefined,
    openaiApiKey: undefined,
    nebiusApiKey: undefined,
    openrouterApiKey: undefined,
    apifyApiKey: undefined,
    joobleApiKey: undefined,
    adzunaAppId: undefined,
    adzunaAppKey: undefined,
  })
}
