// Dokumenten-Designs: drei Themes, die Settings speichern und die Routen
// serverseitig anwenden. resolveDocTemplate ist der Validierpunkt — unbekannte
// Werte fallen aufs Default zurück, statt ein kaputtes Dokument zu erzeugen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DOC_TEMPLATES, DEFAULT_DOC_TEMPLATE, resolveDocTemplate } from '../../lib/documents'

test('there are exactly three templates with stable ids', () => {
  assert.deepEqual(
    DOC_TEMPLATES.map((t) => t.id),
    ['modern', 'klassisch', 'kompakt']
  )
  for (const t of DOC_TEMPLATES) {
    assert.ok(t.label.length > 0, `template ${t.id} needs a label`)
  }
})

test('resolveDocTemplate accepts known ids', () => {
  assert.equal(resolveDocTemplate('modern'), 'modern')
  assert.equal(resolveDocTemplate('klassisch'), 'klassisch')
  assert.equal(resolveDocTemplate('kompakt'), 'kompakt')
})

test('resolveDocTemplate falls back to the default on unknown or missing values', () => {
  assert.equal(DEFAULT_DOC_TEMPLATE, 'modern')
  assert.equal(resolveDocTemplate('fancy'), 'modern')
  assert.equal(resolveDocTemplate(''), 'modern')
  assert.equal(resolveDocTemplate(null), 'modern')
  assert.equal(resolveDocTemplate(undefined), 'modern')
})
