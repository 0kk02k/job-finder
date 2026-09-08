// Status-Regeln: appliedAt markiert den ersten Bewerbungsversand — er wird
// gesetzt, wenn eine bewerbungsimplizierende Stufe erreicht wird, und niemals
// überschrieben oder zurückgenommen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appliedAtFor, STATUS_LABELS } from '../../lib/status'

const NOW = new Date('2026-09-08T12:00:00Z')
const EARLIER = new Date('2026-08-01T09:00:00Z')

test('appliedAt is set when the job moves to APPLIED', () => {
  assert.equal(appliedAtFor('APPLIED', null, NOW), NOW)
})

test('appliedAt is set when the job moves to INTERVIEW without one', () => {
  assert.equal(appliedAtFor('INTERVIEW', null, NOW), NOW)
})

test('an existing appliedAt is never overwritten', () => {
  assert.equal(appliedAtFor('INTERVIEW', EARLIER, NOW), EARLIER)
  assert.equal(appliedAtFor('APPLIED', EARLIER, NOW), EARLIER)
})

test('non-application statuses do not set appliedAt', () => {
  assert.equal(appliedAtFor('REJECTED', null, NOW), null)
  assert.equal(appliedAtFor('ARCHIVED', null, NOW), null)
  assert.equal(appliedAtFor('DISCOVERED', null, NOW), null)
})

test('every JobStatus has a German label', () => {
  for (const status of ['DISCOVERED', 'SCORED', 'HIGH_MATCH', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED', 'ARCHIVED']) {
    assert.ok(STATUS_LABELS[status], `label fehlt für ${status}`)
  }
})
