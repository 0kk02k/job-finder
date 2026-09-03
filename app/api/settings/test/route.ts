import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { aiConfigFromSettings, getAIClient, defaultModel } from '@/lib/ai'
import { generateText } from 'ai'

// POST /api/settings/test — „Verbindung testen“ für die KI-Konfiguration.
// Prüft die GESPEICHERTE Konfiguration (die Fläche verlangt erst Speichern),
// macht genau einen Mini-Aufruf und sagt ehrlich, was passiert ist.
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  const userId = session.user.id

  const settings = await prisma.userSettings.findUnique({ where: { userId } })
  if (!settings) {
    return NextResponse.json({ ok: false, error: 'Keine Einstellungen gefunden — erst speichern.' }, { status: 409 })
  }

  const cfg = aiConfigFromSettings(settings)
  if (['nebius', 'gemini', 'openai', 'openrouter'].includes(cfg.provider) && !cfg.apiKey) {
    return NextResponse.json({
      ok: false,
      error: `Kein ${cfg.provider}-Key hinterlegt — trage ihn oben ein und speichere.`,
    })
  }

  try {
    const ai = getAIClient(cfg.provider, cfg.apiKey, cfg.baseUrl)
    const { text } = await generateText({
      model: ai.chat(cfg.model || defaultModel(cfg.provider)),
      messages: [{ role: 'user', content: 'Antworte mit einem einzigen Wort: OK' }],
    })
    return NextResponse.json({
      ok: true,
      model: cfg.model || defaultModel(cfg.provider),
      answer: (text || '').slice(0, 20),
    })
  } catch (error) {
    console.error('AI connection test failed:', error)
    return NextResponse.json({
      ok: false,
      error: 'Die Verbindung ist fehlgeschlagen — Key, Modell-ID oder Dienst nicht erreichbar.',
    })
  }
}
