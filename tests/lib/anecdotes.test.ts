// Die Mutmaßungen über „zwischen den Zeilen" leben und sterben mit ihren
// Zitatstellen: erfindet die KI ein Zitat, fällt die Mutmaßung weg. Getestet
// wird der Normalisierungs-Vertrag — die KI selbst ist außen vor (lokal kein Key).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseJsonLoose, parseSkills, sanitizeSkillsInput, verifyQuotes } from '../../lib/anecdotes'

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

test('parseJsonLoose unwraps fenced and accompanied JSON', () => {
  assert.deepEqual(parseJsonLoose('```json\n[{"a":1}]\n```'), [{ a: 1 }])
  assert.deepEqual(parseJsonLoose('Hier sind deine Karten:\n[{"a":2}] — viel Erfolg!'), [{ a: 2 }])
  assert.deepEqual(parseJsonLoose('{"needs":[]}'), { needs: [] })
  assert.throws(() => parseJsonLoose('kein JSON hier'))
})

test('parseSkills reads the stored JSON and survives garbage', () => {
  assert.deepEqual(parseSkills('["a","b"]'), ['a', 'b'])
  assert.deepEqual(parseSkills('nix'), [])
  assert.deepEqual(parseSkills('{"x":1}'), [])
})

test('sanitizeSkillsInput trims, drops non-strings, caps count and length', () => {
  assert.deepEqual(sanitizeSkillsInput([' a ', 'b', 42, '']), ['a', 'b'])
  assert.equal(sanitizeSkillsInput(Array.from({ length: 12 }, (_, i) => `skill${i}`)).length, 8)
  assert.deepEqual(sanitizeSkillsInput('kein array'), [])
})
