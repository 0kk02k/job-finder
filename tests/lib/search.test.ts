// Der Query-Fächer: die KI erzeugt fachliche Suchvarianten, damit der Kandidaten-
// pool Treffer enthält, die unter fremden Schlagworten eingestellt wurden. Die
// Ordnungsfunktionen hier sind rein — sie entscheiden, was gefetcht und gerankt wird.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mapWithConcurrency, mergeJobsByUrl, phaseFitsInBudget, pickFuzzyTerms, pickQueryFan } from '../../lib/search'

test('pickQueryFan trims, dedupes against the original and itself, caps at max', () => {
  const fan = pickQueryFan(
    ['Datenmodellierer', '  ', 'Backend-Entwickler', 'datenmodellierer', 'Prozessautomatisierung', 'Noch eins', 'Und noch eins'],
    'Backend-Entwickler',
    3
  )
  assert.deepEqual(fan, ['Datenmodellierer', 'Prozessautomatisierung', 'Noch eins'])
})

test('pickQueryFan survives garbage input', () => {
  assert.deepEqual(pickQueryFan([], 'x', 3), [])
  assert.deepEqual(pickQueryFan([null as unknown as string, 42 as unknown as string], 'x', 3), [])
})

interface UrlJob {
  url: string
  title: string
}

test('mergeJobsByUrl keeps the first occurrence and drops url-less entries', () => {
  const a = { url: 'a', title: 'A-original' }
  const aFan = { url: 'a', title: 'A-fan' }
  const b = { url: 'b', title: 'B' }
  const noUrl = { url: '', title: 'X' }
  const merged = mergeJobsByUrl<UrlJob>([[a, noUrl], [aFan, b]])
  assert.deepEqual(merged, [a, b])
})

test('pickFuzzyTerms returns only unseen, unique terms, capped', () => {
  const terms = pickFuzzyTerms('datenarchitekt|Datenarchitekt|ETL|'.split('|'), ['backend', 'datenarchitekt'], 2)
  assert.deepEqual(terms, ['ETL'])
  assert.deepEqual(pickFuzzyTerms([], ['backend'], 2), [])
})

// Feste Parallelität für die Scoring-Welle: unbegrenztes Promise.all erzeugt
// am Provider einen Rate-Limit-Stau, aus dem der Suchlauf nicht rechtzeitig
// zurückkehrt. Der Vertrag: alle Ergebnisse, reihengetreu, nie mehr als
// `limit` gleichzeitig.
test('mapWithConcurrency maps every item in order', async () => {
  const result = await mapWithConcurrency([3, 1, 2], 2, async (n) => {
    await new Promise((r) => setTimeout(r, n)) // unterschiedliche Dauern
    return `job-${n}`
  })
  assert.deepEqual(result, ['job-3', 'job-1', 'job-2'])
})

test('mapWithConcurrency never exceeds the concurrency limit', async () => {
  let active = 0
  let peak = 0
  await mapWithConcurrency(Array.from({ length: 10 }, (_, i) => i), 3, async () => {
    active++
    peak = Math.max(peak, active)
    await new Promise((r) => setTimeout(r, 5))
    active--
    return true
  })
  assert.equal(peak, 3)
})

test('mapWithConcurrency handles empty input and limit above item count', async () => {
  assert.deepEqual(await mapWithConcurrency([], 4, async (n: number) => n), [])
  assert.deepEqual(await mapWithConcurrency([1, 2], 10, async (n) => n * 2), [2, 4])
})

// Nachfetch-Phasen (Zweitrunde, klassischer Fall-through) tragen eine eigene
// Fetch-Welle mit ~35s Worst Case. Sie dürfen nur starten, wenn das in die
// Gesamtfrist passt — sonst tragen sie den Lauf ans Kill-Limit, statt
// Teilergebnisse zu liefern.
test('phaseFitsInBudget allows phases when no deadline is set', () => {
  assert.equal(phaseFitsInBudget(undefined, 0), true)
})

test('phaseFitsInBudget allows a phase whose worst case still fits before the deadline', () => {
  assert.equal(phaseFitsInBudget(50_000, 14_999), true)
})

test('phaseFitsInBudget blocks a phase once its worst case would cross the deadline', () => {
  assert.equal(phaseFitsInBudget(50_000, 15_000), false)
  assert.equal(phaseFitsInBudget(50_000, 49_000), false)
})
