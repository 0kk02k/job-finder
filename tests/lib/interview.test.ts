// Die Praxisaufgabe ist der einzige IT-verankerte Teil des HR-Interviews.
// Vertrag an den Katalog: Aufgabentypen müssen für jede Fachrichtung
// funktionieren, Technik-Beispiele nur für technische Profile.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MINI_TASK_CATALOG } from '../../lib/interview'

test('catalog offers field-agnostic task types', () => {
  assert.match(MINI_TASK_CATALOG, /Fallvignette/)
  assert.match(MINI_TASK_CATALOG, /Rollenspiel/)
  assert.match(MINI_TASK_CATALOG, /Erkläraufgabe|Erklär-aufgabe|Laien/)
  assert.match(MINI_TASK_CATALOG, /Priorisierung/)
})

test('catalog derives the concrete task from the candidate’s field', () => {
  assert.match(MINI_TASK_CATALOG, /[Ff]achrichtung/)
  assert.match(MINI_TASK_CATALOG, /Lebenslauf/)
})

test('technical examples are scoped to technical profiles', () => {
  assert.match(MINI_TASK_CATALOG, /[Cc]ode-?[Rr]eview/)
  assert.match(MINI_TASK_CATALOG, /technisch/)
})
