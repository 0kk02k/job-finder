// Anekdoten: reine Logik für Mini-Interview, Mutmaßungen mit Zitat-Verifikation
// und den Anekdoten-Block im Anschreiben-Prompt. Bewusst ohne I/O — alles hier
// ist unit-testbar, die Routes bleiben dünne Vermittlungsschicht.

// Normalisierung für die Zitat-Prüfung: Zeilenumbrüche der Anzeige, Groß-/-
// Kleinschreibung und Anführungszeichen dürfen nicht täuschen. Anführungs-
// zeichen werden auf BEIDEN Seiten entfernt — ein Zitat mit „Gänsefüßchen“ um
// die Kernphrase und der blanke Anzeigentext fallen auf dasselbe heraus.
function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[„“”‟«»‚‛‹›‘’"''´`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Ein Zitat ohne wörtlichen Beleg im Anzeigentext ist eine unbelegte
// Spekulation — und die wird nicht gezeigt (Spec: Ehrlichkeitsregel).
export function verifyQuotes(quote: string, adText: string): boolean {
  const normalizedQuote = normalizeText(quote)
  if (!normalizedQuote) return false
  return normalizeText(adText).includes(normalizedQuote)
}

// KI-Antworten kommen gepolstert („Hier ist dein JSON:", Code-Fences, Nachsatz).
// Wir schneiden bis auf den Kern zurück — oder werfen ehrlich.
export function parseJsonLoose(text: string): unknown {
  const stripped = text.replace(/```(?:json)?/gi, '')
  const start = stripped.search(/[{[]/)
  if (start === -1) throw new Error('Kein JSON in der KI-Antwort')
  const end = Math.max(stripped.lastIndexOf('}'), stripped.lastIndexOf(']'))
  if (end <= start) throw new Error('Kein abgeschlossenes JSON in der KI-Antwort')
  return JSON.parse(stripped.slice(start, end + 1))
}

// Gespeicherte Skills sind ein JSON-String (wie matchDetails beim Job) —
// Müll wird zu einer leeren Liste, nie zu einem Crash.
export function parseSkills(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json)
    return sanitizeSkillsInput(parsed)
  } catch {
    return []
  }
}

const MAX_SKILLS = 8
const MAX_SKILL_LEN = 40

// Client-Eingabe (Extract-Karte, Formular): getrimmt, nur Strings, gedeckelt.
export function sanitizeSkillsInput(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.trim().slice(0, MAX_SKILL_LEN))
    .filter(Boolean)
    .slice(0, MAX_SKILLS)
}

export interface AnecdoteInput {
  title: string
  situation: string
  action: string
  result: string
  skills: string[]
}

// Die drei Leitfragen des Mini-Interviews (A1) — bewusst so gefasst, dass sie
// nicht-technische Qualitäten belegen: Druck, Konflikt, Verantwortung, Lernen.
// Die Fläche rendert dieselben Strings wie der Prompt.
export const EXTRACT_QUESTIONS: readonly string[] = [
  'Ein Erfolg, auf den du stolz bist — und worauf er wirklich zurückgeht.',
  'Etwas, das schiefging und das du rettest — oder ein Konflikt, den du gelöst hast.',
  'Eine Aufgabe, die dir niemand zugeteilt hat — wo du ohne Anleitung Verantwortung übernommen hast.',
]

const MAX_PROPOSALS = 5
const MAX_TITLE = 120
const MAX_STORY = 1200

function cappedString(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

// Was die KI vorschlägt, bleibt Vorschlag: unvollständige Geschichten fallen
// weg, nichts wird länger als vereinbart. Speichern tut erst der Nutzer.
export function sanitizeExtractedProposals(raw: unknown): AnecdoteInput[] {
  if (!Array.isArray(raw)) return []
  const proposals: AnecdoteInput[] = []
  for (const item of raw.slice(0, MAX_PROPOSALS)) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    const proposal: AnecdoteInput = {
      title: cappedString(record.title, MAX_TITLE),
      situation: cappedString(record.situation, MAX_STORY),
      action: cappedString(record.action, MAX_STORY),
      result: cappedString(record.result, MAX_STORY),
      skills: sanitizeSkillsInput(record.skills),
    }
    // Titel allein ist keine Geschichte — wenigstens ein Stern-Feld muss stehen.
    if (!proposal.situation && !proposal.action && !proposal.result) continue
    proposals.push(proposal)
  }
  return proposals
}

export function buildExtractPrompt(answers: string[]): string {
  const told = answers
    .map((answer, i) => `${i + 1}. ${EXTRACT_QUESTIONS[i] ?? 'Weitere Geschichte:'}\n${answer}`)
    .join('\n\n')
  return `Der Nutzer hat über seine beruflichen Erfahrungen erzählt. Forme daraus
bis zu 5 wahre Anekdoten als JSON-Array. Jede Anekdote:

{
  "title": "kurzer prägnanter Titel",
  "situation": "Anlass und Umfeld",
  "action": "was der Nutzer konkret getan hat",
  "result": "was herauskam",
  "skills": ["2-4 nicht-technische Qualitäten, die die Geschichte belegt"]
}

Wahrheitsregeln: Forme nur, was der Nutzer erzählt hat — erfinde nichts dazu,
ergänze keine Zahlen, keine Firmen, keine Details. Kürze auf das Wesentliche,
sprich die Geschichte so, wie der Nutzer sie erzählt hat (Sprache der Antworten).

Erzählte Geschichten:

${told}

Gib AUSSCHLIESSLICH das JSON-Array aus — kein Vorwort, keine Anmerkungen.`
}

export interface NeedGuess {
  quote: string
  need: string
  why: string
}

export interface AnecdoteMatch {
  anecdoteId: string
  reason: string
  addresses: number[]
}

const MAX_NEEDS = 4
const MAX_QUOTE = 300
const MAX_NEED = 200
const MAX_WHY = 400
const MAX_MATCHES = 3
const MAX_REASON = 300

// Nur belegte Mutmaßungen überleben: ein Bedürfnis ohne wörtliche Zitatstelle
// in der Anzeige wird nicht gezeigt (Spec: „beleglose Spekulation wird nicht
// gezeigt").
export function sanitizeNeeds(raw: unknown, adText: string): NeedGuess[] {
  if (!Array.isArray(raw)) return []
  const needs: NeedGuess[] = []
  for (const item of raw.slice(0, MAX_NEEDS * 2)) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    const quote = cappedString(record.quote, MAX_QUOTE)
    const need = cappedString(record.need, MAX_NEED)
    const why = cappedString(record.why, MAX_WHY)
    if (!need || !verifyQuotes(quote, adText)) continue
    needs.push({ quote, need, why })
    if (needs.length >= MAX_NEEDS) break
  }
  return needs
}

export function sanitizeMatches(
  raw: unknown,
  anecdoteIds: readonly string[],
  needCount: number
): AnecdoteMatch[] {
  if (!Array.isArray(raw)) return []
  const known = new Set(anecdoteIds)
  const matches: AnecdoteMatch[] = []
  const seen = new Set<string>()
  for (const item of raw.slice(0, MAX_MATCHES * 2)) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    const anecdoteId = typeof record.anecdoteId === 'string' ? record.anecdoteId : ''
    if (!known.has(anecdoteId) || seen.has(anecdoteId)) continue
    seen.add(anecdoteId)
    const addresses = Array.isArray(record.addresses)
      ? [...new Set(record.addresses)]
          .filter((i): i is number => typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < needCount)
          .slice(0, 3)
      : []
    matches.push({ anecdoteId, reason: cappedString(record.reason, MAX_REASON), addresses })
    if (matches.length >= MAX_MATCHES) break
  }
  return matches
}

// Der Need kommt vom Client zurück (aus der Chooser-Auswahl) — dem wird nicht
// vertraut: Form geprüft, Zitat erneut gegen die Anzeige verifiziert, Längen
// gedeckelt. `null` heißt: Anekdote ja, Mutmaßung unbelegbar → weglassen.
export function sanitizeNeedPayload(raw: unknown, adText: string): NeedGuess | null {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  const quote = cappedString(record.quote, MAX_QUOTE)
  const need = cappedString(record.need, MAX_NEED)
  if (!need || !verifyQuotes(quote, adText)) return null
  return { quote, need, why: cappedString(record.why, MAX_WHY) }
}

export function buildMatchPrompt(
  adDescription: string,
  anecdotes: Array<{ id: string } & AnecdoteInput>
): string {
  const list = anecdotes
    .map(
      (a) =>
        `id: ${a.id}\nTitel: ${a.title}\nSituation: ${a.situation}\nGetan: ${a.action}\nErgebnis: ${a.result}\nQualitäten: ${a.skills.join(', ')}`
    )
    .join('\n\n')
  return `Lies diese Stellenanzeige und stelle Mutmaßungen an: Welche NICHT-technischen
Bedürfnisse hat der Arbeitgeber zwischen den Zeilen? (z. B. Selbstständigkeit,
Druckresistenz, Konfliktfähigkeit, Lernbereitschaft, Loyalität)

Stellenanzeige:
${adDescription}

Anekdoten des Nutzers (wahre Geschichten):

${list}

Liefere JSON:

{
  "needs": [
    { "quote": "WÖRTLICHES Zitat aus der Anzeige als Beleg — kopiere den Text Zeichen für Zeichen",
      "need": "das vermutete nicht-technische Bedürfnis",
      "why": "ein Satz: woran du es erkennst" }
  ],
  "matches": [
    { "anecdoteId": "id der passendsten Anekdote",
      "reason": "ein Satz: warum diese Geschichte dieses Bedürfnis belegt",
      "addresses": [Indizes der needs, die die Anekdote beantwortet] }
  ]
}

Regeln: 2-4 Mutmaßungen, jede mit wörtlichem Zitat aus der Anzeige — erfinde
keine Zitate. Rangiere höchstens 3 Anekdote-IDs, die besten zuerst. Gib
AUSSCHLIESSLICH das JSON aus.`
}

// Der Block im Anschreiben-Prompt: die Anekdote ist Wahrheitsmaterial — die KI
// darf kürzen und auf die Stelle zuspitzen, aber nichts erfinden. Und sie ist
// der Aufhänger: Einleitung heißt Anekdote, nicht Motivationsformel.
export function anecdoteToPromptBlock(anecdote: AnecdoteInput, need: NeedGuess | null): string {
  const needBlock = need
    ? `
Mutmaßung, die die Anekdote belegen soll: ${need.need}
Belegstelle aus der Anzeige: „${need.quote}"${need.why ? `\nWarum: ${need.why}` : ''}`
    : ''
  return `WAHRE ANEKDOTE DES NUTZERS — Wahrheitsmaterial: kürzen, fokussieren, auf
die Stelle zuspitzen. Erfinde nichts dazu und ergänze keine Zahlen.

Titel: ${anecdote.title}
Situation: ${anecdote.situation}
Was ich getan habe: ${anecdote.action}
Ergebnis: ${anecdote.result}${needBlock}

Das Anschreiben ÖFFNET mit dieser Anekdote: Sie ist die Einleitung (Strukturpunkt 1)
— kein generischer Motivationssatz. Der Rest der Struktur bleibt.`
}
