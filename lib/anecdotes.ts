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
