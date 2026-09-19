import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { z } from 'zod'
import { resolveKeyHint } from '@/lib/keys'

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
// Ohne eigenen Key meldet die Umgebung (Vercel-Env) ihren Key — dieselben
// Namen, auf die die Laufzeit ohnehin zurückfällt — mit Quelle „env“.
const KEY_FIELDS = ['geminiApiKey', 'openaiApiKey', 'nebiusApiKey', 'openrouterApiKey', 'apifyApiKey', 'joobleApiKey', 'adzunaAppId', 'adzunaAppKey'] as const

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
  const slots = {
    geminiKey: resolveKeyHint(_g, process.env.GEMINI_API_KEY),
    openaiKey: resolveKeyHint(_o, process.env.OPENAI_API_KEY),
    nebiusKey: resolveKeyHint(_n, process.env.NEBIUS_API_KEY),
    openrouterKey: resolveKeyHint(_r, process.env.OPENROUTER_API_KEY),
    apifyKey: resolveKeyHint(_a, process.env.APIFY_API_KEY),
    joobleKey: resolveKeyHint(_j, process.env.JOOBLE_API_KEY),
    adzunaAppId: resolveKeyHint(_ai, process.env.ADZUNA_APP_ID),
    adzunaAppKey: resolveKeyHint(_ak, process.env.ADZUNA_APP_KEY),
  }
  return NextResponse.json({
    ...rest,
    geminiKeyHint: slots.geminiKey.hint,
    geminiKeySource: slots.geminiKey.source,
    openaiKeyHint: slots.openaiKey.hint,
    openaiKeySource: slots.openaiKey.source,
    nebiusKeyHint: slots.nebiusKey.hint,
    nebiusKeySource: slots.nebiusKey.source,
    openrouterKeyHint: slots.openrouterKey.hint,
    openrouterKeySource: slots.openrouterKey.source,
    apifyKeyHint: slots.apifyKey.hint,
    apifyKeySource: slots.apifyKey.source,
    joobleKeyHint: slots.joobleKey.hint,
    joobleKeySource: slots.joobleKey.source,
    adzunaAppIdHint: slots.adzunaAppId.hint,
    adzunaAppIdSource: slots.adzunaAppId.source,
    adzunaAppKeyHint: slots.adzunaAppKey.hint,
    adzunaAppKeySource: slots.adzunaAppKey.source,
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
