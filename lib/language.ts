// Spracherkennung für Stellenanzeigen und Lebensläufe — offline und
// deterministisch. Sie entscheidet nur, OB ein Dokument übersetzt wird,
// nicht wie (das ist KI-Arbeit im Übersetzungsprompt). Deutsch ist Default:
// Der Produktmarkt ist deutsch, und Gleichstand/Unklarheit soll keinen
// KI-Aufruf auslösen.
export type Language = 'de' | 'en'

// Häufige Funktionswörter beider Sprachen — Frequenz schlägt Einzelwörter
const GERMAN_MARKERS = [
  'der', 'die', 'das', 'und', 'mit', 'für', 'von', 'auf', 'im', 'zur', 'nach',
  'als', 'wir', 'unsere', 'unser', 'sie', 'ihr', 'eine', 'einen', 'einem',
  'ist', 'sind', 'wird', 'werden', 'bitte', 'über', 'bei', 'aus', 'sich',
]
const ENGLISH_MARKERS = [
  'the', 'and', 'of', 'to', 'with', 'for', 'you', 'your', 'our', 'we', 'are',
  'will', 'is', 'as', 'at', 'from', 'that', 'this', 'be', 'have', 'has',
  'join', 'looking', 'about', 'or', 'in',
]

function countMarkers(lower: string, markers: string[]): number {
  let count = 0
  for (const marker of markers) {
    // Wortgrenzen, damit „die" nicht in „Studien" läuft
    const matches = lower.match(new RegExp(`\\b${marker}\\b`, 'g'))
    count += matches ? matches.length : 0
  }
  return count
}

export function detectLanguage(text: string): Language {
  const lower = text.toLowerCase()
  const german = countMarkers(lower, GERMAN_MARKERS)
  const english = countMarkers(lower, ENGLISH_MARKERS)
  // Umlaute/Eszett sind starke deutsche Beweise (Funktionswörter fehlen oft
  // in fachsprachlichen Kurzen)
  const umlauts = (lower.match(/[äöüß]/g) ?? []).length
  return german + umlauts >= english ? 'de' : 'en'
}
