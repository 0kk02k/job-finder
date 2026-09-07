// Gecashte Anzeigen kommen oft als eine einzige Textzeile ohne Umbrüche aus
// den Feeds. structureJobDescription muss daraus Absätze und Abschnitte machen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeTextContent, structureJobDescription } from '../../../app/components/Markdown'

const WALL =
  'Wir suchen eine erfahrene Frontend-Entwicklerin für unser Team in Berlin. Sie gestalten unsere Web-Applikationen aktiv mit. ' +
  'Ihre Aufgaben: Entwicklung neuer Features mit React und TypeScript. Pflege bestehender Komponenten. ' +
  'Wir bieten: flexible Arbeitszeiten, 30 Tage Urlaub und ein starkes Team.'

test('keeps normalizeTextContent behavior: entities and bullets', () => {
  assert.equal(normalizeTextContent('Gehalt &amp; Benefits'), 'Gehalt & Benefits')
  assert.match(normalizeTextContent('• Erste Aufgabe\n• Zweite'), /^- Erste Aufgabe\n- Zweite$/)
})

test('splits a wall of text into paragraphs at sentence boundaries', () => {
  const structured = structureJobDescription(WALL)
  assert.ok(structured.includes('\n\n'), 'expected paragraph breaks')
  // Kein Satz geht verloren
  assert.match(structured, /Frontend-Entwicklerin für unser Team in Berlin\./)
  assert.match(structured, /starkes Team\.$/)
})

test('isolates known ad headings as section headings', () => {
  const structured = structureJobDescription(WALL)
  assert.match(structured, /## Ihre Aufgaben/)
  assert.match(structured, /## Wir bieten/)
  // Der Rest des Satzes bleibt Inhalt, keine Überschrift
  assert.match(structured, /## Ihre Aufgaben\n\nEntwicklung neuer Features/)
})

test('marks a heading-only line as section heading', () => {
  const structured = structureJobDescription('Über uns\n\nWir sind ein mittelständisches Unternehmen aus Hamburg.')
  assert.match(structured, /## Über uns/)
  assert.match(structured, /Wir sind ein mittelständisches Unternehmen/)
})

test('promotes heading-only lines even in already-structured text', () => {
  const text = 'Aufgaben:\n- Bewerbung annehmen\n- Kandidaten pflegen'
  assert.equal(structureJobDescription(text), '## Aufgaben\n- Bewerbung annehmen\n- Kandidaten pflegen')
})

test('leaves short non-heading lines alone', () => {
  const text = 'Filialleiter (m/w/d)\n- Kassieren\n- Regale einräumen'
  assert.equal(structureJobDescription(text), text)
})
