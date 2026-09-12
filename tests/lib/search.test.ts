// Der Query-Fächer: die KI erzeugt fachliche Suchvarianten, damit der Kandidaten-
// pool Treffer enthält, die unter fremden Schlagworten eingestellt wurden. Die
// Ordnungsfunktionen hier sind rein — sie entscheiden, was gefetcht und gerankt wird.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeJobsByUrl, pickFuzzyTerms, pickQueryFan } from '../../lib/search'

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
