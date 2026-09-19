// Key-Hinweise der Settings-Seite: eigenes Feld schlägt Umgebung (Vercel) —
// die Umgebung wird gemeldet statt verschwiegen, denn sie fängt zur Laufzeit
// ohnehin auf (getAIClient, Suchroute). Klartext verlässt den Server nie.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { maskKey, keyPlaceholder, resolveKeyHint } from '../../lib/keys'

test('nutzereigener Key gewinnt und bleibt maskiert', () => {
  assert.deepEqual(resolveKeyHint('abcd12345678', 'envkey9876'), { hint: '••••5678', source: 'user' })
})

test('ohne eigenen Key meldet die Umgebung ihren Key', () => {
  assert.deepEqual(resolveKeyHint(null, 'envkey9876'), { hint: '••••9876', source: 'env' })
})

test('weder eigenes Feld noch Umgebung → kein Hinweis, keine Quelle', () => {
  assert.deepEqual(resolveKeyHint(null, undefined), { hint: null, source: null })
  assert.deepEqual(resolveKeyHint(undefined, null), { hint: null, source: null })
})

test('nur Leerzeichen zählt als nicht hinterlegt', () => {
  assert.deepEqual(resolveKeyHint('   ', undefined), { hint: null, source: null })
  assert.deepEqual(resolveKeyHint(null, '   '), { hint: null, source: null })
})

test('maskKey zeigt nur die letzten vier Zeichen', () => {
  assert.equal(maskKey('abcd12345678'), '••••5678')
  assert.equal(maskKey(null), null)
  assert.equal(maskKey(''), null)
})

test('Platzhalter spricht nach Quelle — Umgebung überschreibt man, eigenes behält man', () => {
  assert.equal(
    keyPlaceholder('••••5678', 'user'),
    'Bereits hinterlegt: ••••5678 — zum Behalten leer lassen'
  )
  assert.equal(
    keyPlaceholder('••••9876', 'env'),
    'Hinterlegt (Umgebung): ••••9876 — eigenes Feld überschreibt sie'
  )
})

test('ohne Hinweis gilt der ehrliche Leerstand, App-ID hat eigenen Wortlaut', () => {
  assert.equal(keyPlaceholder(null, null), 'Noch kein Schlüssel hinterlegt')
  assert.equal(keyPlaceholder(null, null, 'Noch keine App-ID hinterlegt'), 'Noch keine App-ID hinterlegt')
})
