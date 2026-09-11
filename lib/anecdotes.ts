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
