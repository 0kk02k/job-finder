// Die Mutmaßungen über „zwischen den Zeilen" leben und sterben mit ihren
// Zitatstellen: erfindet die KI ein Zitat, fällt die Mutmaßung weg. Getestet
// wird der Normalisierungs-Vertrag — die KI selbst ist außen vor (lokal kein Key).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  EXTRACT_QUESTIONS,
  buildExtractPrompt,
  parseJsonLoose,
  parseSkills,
  sanitizeExtractedProposals,
  sanitizeSkillsInput,
  verifyQuotes,
} from '../../lib/anecdotes'

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

test('sanitizeExtractedProposals keeps complete stories, drops empties, caps sizes', () => {
  const raw = [
    {
      title: 'Deploy-Freitag',
      situation: 'Ausfall um 17 Uhr',
      action: 'Rollback entschieden und kommuniziert',
      result: 'Keine Ausfälle im Weihnachtsgeschäft',
      skills: ['Druck', 'Entscheidung'],
    },
    { title: 'Leere Karte', situation: '', action: '', result: '', skills: [] },
    { title: 'X'.repeat(500), situation: 's', action: 'a', result: 'r', skills: [] },
  ]
  const clean = sanitizeExtractedProposals(raw)
  assert.equal(clean.length, 2)
  assert.equal(clean[0].title, 'Deploy-Freitag')
  assert.ok(clean[1].title.length <= 120)
  clean.forEach((p) => {
    assert.equal(typeof p.title, 'string')
    assert.equal(typeof p.situation, 'string')
    assert.equal(typeof p.action, 'string')
    assert.equal(typeof p.result, 'string')
    assert.ok(Array.isArray(p.skills))
  })
})

test('sanitizeExtractedProposals survives non-array input', () => {
  assert.deepEqual(sanitizeExtractedProposals(undefined), [])
  assert.deepEqual(sanitizeExtractedProposals('nope'), [])
  assert.deepEqual(sanitizeExtractedProposals([{ title: 't' }]), [])
})

test('buildExtractPrompt carries all three questions, the answers and the truth rules', () => {
  const prompt = buildExtractPrompt(['Ich habe 2019 das Team geleitet.', 'Ein Kunde drohte zu kündigen.', 'Niemand wollte die Migration.'])
  EXTRACT_QUESTIONS.forEach((q) => assert.ok(prompt.includes(q), `Frage fehlt: ${q}`))
  assert.match(prompt, /2019/)
  assert.match(prompt, /erfinde|nichts dazu/i)
  assert.match(prompt, /JSON/)
})
