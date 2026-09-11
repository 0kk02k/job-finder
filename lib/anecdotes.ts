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
  if (!quote || !adText) return false
  return normalizeText(adText).includes(normalizeText(quote))
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
