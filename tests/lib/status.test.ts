// Status-Regeln: appliedAt markiert den ersten Bewerbungsversand — er wird
// gesetzt, wenn eine bewerbungsimplizierende Stufe erreicht wird, und niemals
// überschrieben oder zurückgenommen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appliedAtFor, rejectedAtFor, STATUS_LABELS, isBacklogJob } from '../../lib/status'

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

// rejectedAt markiert die erste Absage — dieselbe Unumkehrlichkeits-Regel wie
// appliedAt: gesetzt beim REJECTED-Übergang, nie überschrieben, nie zurückgenommen.
test('rejectedAt is set when the job moves to REJECTED', () => {
  assert.equal(rejectedAtFor('REJECTED', null, NOW), NOW)
})

test('an existing rejectedAt is never overwritten', () => {
  assert.equal(rejectedAtFor('REJECTED', EARLIER, NOW), EARLIER)
})

test('other statuses keep rejectedAt unchanged (set or null)', () => {
  assert.equal(rejectedAtFor('APPLIED', null, NOW), null)
  assert.equal(rejectedAtFor('INTERVIEW', null, NOW), null)
  assert.equal(rejectedAtFor('ARCHIVED', EARLIER, NOW), EARLIER)
  assert.equal(rejectedAtFor('DISCOVERED', EARLIER, NOW), EARLIER)
})

test('every JobStatus has a German label', () => {
  for (const status of ['DISCOVERED', 'SCORED', 'HIGH_MATCH', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED', 'ARCHIVED']) {
    assert.ok(STATUS_LABELS[status], `label fehlt für ${status}`)
  }
})

// Eine Rückstand-Definition für Dashboard, /jobs und score-batch: Score fehlt
// UND weder archiviert (ignorieren landet dort) noch abgelehnt.
test('backlog = score null and neither archived nor rejected', () => {
  assert.equal(isBacklogJob({ score: null, status: 'DISCOVERED' }), true)
  assert.equal(isBacklogJob({ score: null, status: 'HIGH_MATCH' }), true)
  assert.equal(isBacklogJob({ score: null, status: 'APPLIED' }), true)
  assert.equal(isBacklogJob({ score: 8, status: 'DISCOVERED' }), false)
  assert.equal(isBacklogJob({ score: null, status: 'ARCHIVED' }), false)
  assert.equal(isBacklogJob({ score: null, status: 'REJECTED' }), false)
})
