// Präferenz-Profil: der reine Kern des Präferenz-Gesprächs — Guide, Opening,
// Sanitizing, Rendering. Bewusst import-frei (außer erloschenen type-imports),
// damit Client-Komponenten (Settings-Karte) ihn bundeln können, ohne das
// AI-SDK zu ziehen — dieselbe Disziplin wie lib/matching.ts. Das Gespräch
// selbst (KI-Calls) lebt in lib/preferences.ts.

import type { GuideItem } from './interview'

export type { GuideItem }

export interface PreferenceCriteria {
  topic: string
  weight: 'hoch' | 'mittel' | 'niedrig'
  note: string // Beleg im Wortlaut des Nutzers, kurz
}

export interface PreferenceProfile {
  version: 1
  enjoys: string // was jetzt Freude macht
  criteria: PreferenceCriteria[] // gewichtete Kriterien
  avoids: string[] // No-Gos
  growth: string // wohin die Reise gehen soll
  summary: string // 1-2 Sätze — Kern der Kompaktversion
  keywords: string[] // kurze suchrelevante Begriffe (Rollen, Schwerpunkte)
}

export const PREFERENCE_GUIDE: GuideItem[] = [
  {
    id: 'enjoy',
    category: 'Heute',
    topic: 'Was dir an deiner Arbeit liegt',
    criteria:
      'Mindestens zwei konkrete Tätigkeiten oder Themen mit Alltagsbezug, die der Kandidat gern tut — keine bloßen Eigenschaften („Teamplayer“).',
  },
  {
    id: 'weights',
    category: 'Gewichtung',
    topic: 'Was dir bei einem Arbeitgeber wichtig ist',
    criteria:
      'Mindestens drei Kriterien benannt (z. B. Tech-Stack, Team, Remote, Gehalt, Sicherheit, Wachstum, Sinn) und für mindestens zwei ist der relative Rang klar (was wiegt schwerer).',
  },
  {
    id: 'avoid',
    category: 'Grenzen',
    topic: 'Was du vermeiden willst',
    criteria:
      'Mindestens ein No-Go mit Begründung — oder der ausdrückliche Satz, dass es nichts Ausdrücklich Auszuschließendes gibt.',
  },
  {
    id: 'growth',
    category: 'Entwicklung',
    topic: 'Wohin du dich entwickeln willst',
    criteria:
      'Eine Richtung oder Rolle für die nächsten 2–3 Jahre ist klar, plus was dafür noch fehlt oder wachsen soll.',
  },
]

export const PREFERENCE_OPENING_MESSAGE = `Hallo! Schön, dass du da bist. In diesem kurzen Gespräch — etwa zehn Minuten — geht es um dich: Was dir an deiner Arbeit wirklich Freude macht, was dir bei einem Arbeitgeber wichtig ist, was du vermeiden willst und wohin du dich entwickeln möchtest. Ich habe deinen Lebenslauf gelesen und greife im Gespräch darauf auf. Im Hintergrund habe ich vier Themen; am Ende erstelle ich daraus dein Präferenzen-Profil — es fließt in die Job-Bewertung und deine Suche ein.

Du kannst jederzeit pausieren oder Rückfragen stellen — wir kommen schon durch alles durch.

Dann legen wir los: **Was macht an deinen aktuellen und früheren Aufgaben am meisten Freude — worauf freust du dich von allein?**`

// ---------------------------------------------------------------------------
// Sanitizing — die KI erfindet nichts, was bleibt
// ---------------------------------------------------------------------------

const MAX_ENJOYS = 400
const MAX_GROWTH = 400
const MAX_SUMMARY = 300
const MAX_CRITERIA = 8
const MAX_TOPIC = 60
const MAX_NOTE = 200
const MAX_AVOIDS = 5
const MAX_AVOID = 120
const MAX_KEYWORDS = 8
const MAX_KEYWORD = 40

const WEIGHTS = ['hoch', 'mittel', 'niedrig'] as const

function cappedString(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function cappedList(raw: unknown, maxCount: number, maxLen: number): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxCount)
}

// Was die KI synthetisiert, bleibt geprüft: Längen gedeckelt, unbekannte
// Gewichte auf mittel, leere Einträge weg — und ein Profil ohne irgendeine
// Substanz ist keins (null statt hohles Objekt).
export function sanitizePreferenceProfile(raw: unknown): PreferenceProfile | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>

  const criteria: PreferenceCriteria[] = []
  if (Array.isArray(record.criteria)) {
    for (const item of record.criteria.slice(0, MAX_CRITERIA)) {
      if (typeof item !== 'object' || item === null) continue
      const c = item as Record<string, unknown>
      const topic = cappedString(c.topic, MAX_TOPIC)
      if (!topic) continue
      const weight = WEIGHTS.find((w) => w === c.weight) ?? 'mittel'
      criteria.push({ topic, weight, note: cappedString(c.note, MAX_NOTE) })
    }
  }

  const enjoys = cappedString(record.enjoys, MAX_ENJOYS)
  const avoids = cappedList(record.avoids, MAX_AVOIDS, MAX_AVOID)
  const growth = cappedString(record.growth, MAX_GROWTH)

  // Jede Dimension leer heißt: Die KI hat nichts Belegtes geliefert — dann ist
  // ehrlich kein Profil da.
  if (!enjoys && criteria.length === 0 && avoids.length === 0 && !growth) return null

  return {
    version: 1,
    enjoys,
    criteria,
    avoids,
    growth,
    summary: cappedString(record.summary, MAX_SUMMARY),
    keywords: cappedList(record.keywords, MAX_KEYWORDS, MAX_KEYWORD),
  }
}

// Gespeicherte Profile sind ein JSON-String (App-Konvention, wie matchDetails
// beim Job) — Müll wird zu null, nie zu einem Crash.
export function parseStoredProfile(json: string | null | undefined): PreferenceProfile | null {
  if (!json) return null
  try {
    return sanitizePreferenceProfile(JSON.parse(json))
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Rendering — deterministisch, denn der Block steht im Cache-Präfix des
// Scoring-Prompts: gleiche Eingabe muss byte-identisch rendern
// ---------------------------------------------------------------------------

export function renderPreferenceBlock(p: PreferenceProfile): string {
  const lines: string[] = []
  if (p.enjoys) lines.push(`- Sucht/Freude: ${p.enjoys}`)
  if (p.criteria.length > 0) {
    lines.push(`- Gewichtung: ${p.criteria.map((c) => `${c.topic} (${c.weight})`).join(' · ')}`)
    for (const c of p.criteria) {
      if (c.note) lines.push(`  - ${c.topic}: ${c.note}`)
    }
  }
  if (p.avoids.length > 0) lines.push(`- Meidet: ${p.avoids.join('; ')}`)
  if (p.growth) lines.push(`- Entwicklung: ${p.growth}`)
  return lines.join('\n')
}

// Kompaktversion für Prompts mit engem Budget (semantisches Ranking, Query-
// Generierung): die Kernaussagen in einer Zeile, hoch Gewichtetes zuerst.
export function condensePreferenceProfile(p: PreferenceProfile, maxChars = 500): string {
  const parts: string[] = []
  if (p.summary) parts.push(p.summary)
  const top = p.criteria.filter((c) => c.weight === 'hoch').map((c) => c.topic)
  if (top.length > 0) parts.push(`Wichtig: ${top.join(', ')}`)
  if (p.avoids.length > 0) parts.push(`Meidet: ${p.avoids.join(', ')}`)
  if (p.growth) parts.push(`Entwicklung: ${p.growth}`)
  const joined = parts.join(' | ')
  return joined.length > maxChars ? joined.slice(0, maxChars).trimEnd() : joined
}

// ---------------------------------------------------------------------------
// Evidenz-Verifikation — abgehakt wird nur, was im Verlauf belegt ist
// ---------------------------------------------------------------------------

// Normalisierung für den Beleg-Check. Exportiert: auch das Interview-Transkript
// verifiziert seine Zitate damit — zwei Gespräche, ein Beleg-Maßstab.
export function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

// Signifikante Wort-Token (≥3 Zeichen; \p{L} erfasst Umlaute und ß).
function significantTokens(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []
}

// Ein Beleg gilt als belegt, wenn er wörtlich (whitespace-/case-normalisiert)
// im Transkript steht — oder als Paraphrase durchgeht: ≥80% seiner Wort-Token
// kommen im Transkript vor. Kleine Modelle (GLM-Flash) paraphrasieren und
// kürzen beim Zitieren systematisch; der strenge Substring-Check ließ dadurch
// echte Abhakungen sterben („1 von 4" trotz fertigem Gespräch). Ein erfundener
// Beleg scheitert klar an der Quote; Füllwort-Sprüche an der Mindestzahl
// unterscheidender Token.
const FUZZY_EVIDENCE_RATIO = 0.8
const MIN_FUZZY_TOKENS = 3

function evidenceSupported(
  evidence: string,
  normalizedHistory: string,
  historyTokens: Set<string>
): boolean {
  if (normalizedHistory.includes(normalizeForMatch(evidence))) return true
  const tokens = [...new Set(significantTokens(evidence))]
  if (tokens.length < MIN_FUZZY_TOKENS) return false
  const hits = tokens.filter((token) => historyTokens.has(token)).length
  return hits / tokens.length >= FUZZY_EVIDENCE_RATIO
}

// Die Klassifikator-Antwort ({completed:[{id,evidence}]}) wird hier zu puren
// IDs verdichtet: nur bekannte IDs, Beleg ≥ 10 Zeichen, wörtlich oder als
// Paraphrase im Transkript belegt (siehe evidenceSupported) — halluzinierte
// Abhakungen fallen weg. Duplikate zählen einmal, Reihenfolge = Reihenfolge
// der Antwort.
export function filterVerifiedEvidence(
  raw: unknown,
  validIds: readonly string[],
  history: string
): string[] {
  const entries: unknown[] = Array.isArray(raw) ? raw : []
  const known = new Set(validIds)
  const normalizedHistory = normalizeForMatch(history)
  const historyTokens = new Set(significantTokens(history))

  const ids: string[] = []
  const seen = new Set<string>()
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as Record<string, unknown>
    const id = typeof record.id === 'string' ? record.id : ''
    const evidence = typeof record.evidence === 'string' ? record.evidence : ''
    if (!id || !known.has(id) || seen.has(id)) continue
    if (evidence.trim().length < 10) continue
    if (!evidenceSupported(evidence, normalizedHistory, historyTokens)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}
