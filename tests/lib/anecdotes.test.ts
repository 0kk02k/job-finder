// Die Mutmaßungen über „zwischen den Zeilen" leben und sterben mit ihren
// Zitatstellen: erfindet die KI ein Zitat, fällt die Mutmaßung weg. Getestet
// wird der Normalisierungs-Vertrag — die KI selbst ist außen vor (lokal kein Key).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verifyQuotes } from '../../lib/anecdotes'

test('verifyQuotes accepts verbatim quotes despite case, line breaks, and quote glyphs', () => {
  const ad = 'Wir suchen jemanden, der Prioritäten in einem schnell wachsenden\n  Umfeld setzt.'
  assert.equal(verifyQuotes('Prioritäten in einem schnell wachsenden Umfeld setzt', ad), true)
  assert.equal(verifyQuotes('„Prioritäten in einem schnell wachsenden Umfeld setzt“', ad), true)
  assert.equal(verifyQuotes('PRIORITÄTEN IN EINEM SCHNELL WACHSENDEN', ad), true)
})

test('verifyQuotes rejects invented quotes and empty input', () => {
  const ad = 'Wir suchen jemanden mit Erfahrung in der Lagerlogistik.'
  assert.equal(verifyQuotes('Wir zahlen Bestgehälter', ad), false)
  assert.equal(verifyQuotes('', ad), false)
  assert.equal(verifyQuotes('Lagerlogistik', ''), false)
})
