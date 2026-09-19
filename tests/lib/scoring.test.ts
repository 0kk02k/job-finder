// Scoring auf Abruf: dieselben Persistenz-Regeln wie im Suchfluss (app/api/search)
// — Status aus der Score-Schwelle, Match-Details als JSON — und die Batch-Auswahl
// für den Rückstand (unbewertet, älteste zuerst, begrenzt).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoreUpdatePayload, pickUnscoredBatch, batchControlState } from '../../lib/scoring'

const THRESHOLD = 8

test('a score at the high-match threshold becomes HIGH_MATCH', () => {
  const payload = scoreUpdatePayload(
    { score: 8, reason: 'Sehr passende Skills', strengths: ['TypeScript'], gaps: [] },
    THRESHOLD
  )
  assert.equal(payload.status, 'HIGH_MATCH')
  assert.equal(payload.score, 8)
  assert.equal(payload.scoreReason, 'Sehr passende Skills')
})

test('a score below the threshold becomes SCORED', () => {
  const payload = scoreUpdatePayload(
    { score: 7, reason: 'Gut mit Lücken', strengths: [], gaps: ['Deutsch C2'] },
    THRESHOLD
  )
  assert.equal(payload.status, 'SCORED')
})

test('matchDetails carries strengths and gaps as JSON', () => {
  const payload = scoreUpdatePayload(
    { score: 9, reason: 'r', strengths: ['React', 'SQL'], gaps: ['Großer Kunde'] },
    THRESHOLD
  )
  assert.deepEqual(JSON.parse(payload.matchDetails), {
    strengths: ['React', 'SQL'],
    gaps: ['Großer Kunde'],
  })
})

test('missing strengths and gaps persist as empty arrays', () => {
  const payload = scoreUpdatePayload({ score: 5, reason: 'r' }, THRESHOLD)
  assert.deepEqual(JSON.parse(payload.matchDetails), { strengths: [], gaps: [] })
})

interface BatchJob {
  id: string
  score: number | null
  createdAt: string
}

const job = (id: string, daysAgo: number, score: number | null): BatchJob => ({
  id,
  score,
  createdAt: new Date(Date.parse('2026-09-10T12:00:00Z') - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
})

test('pickUnscoredBatch takes only unscored jobs, oldest first, limited', () => {
  const jobs = [
    job('fresh-scored', 1, 9),
    job('old-unscored', 90, null),
    job('mid-unscored', 40, null),
    job('old-scored', 80, 6),
    job('fresh-unscored', 2, null),
  ]
  const batch = pickUnscoredBatch(jobs, 2)
  assert.deepEqual(batch.map((j) => j.id), ['old-unscored', 'mid-unscored'])
})

test('pickUnscoredBatch returns everything unscored when under the limit', () => {
  const jobs = [job('a', 5, null), job('b', 3, 7)]
  const batch = pickUnscoredBatch(jobs, 20)
  assert.deepEqual(batch.map((j) => j.id), ['a'])
})

test('pickUnscoredBatch on an empty pool is empty', () => {
  assert.deepEqual(pickUnscoredBatch<BatchJob>([], 20), [])
})

// Der Rückstand-Kasten teilt sich eine Entscheidung zwischen beiden Filter-
// Zweigen: sichtbar, solange Rückstand ODER laufender Batch existiert; im Lauf
// heißt die Aktion „Stoppen“. Vor Runde 10 (P2) war ein laufender Batch in der
// Bewertet-Ansicht nicht abbrechbar — „Stoppen“ gab es nur im Unbewertet-Zweig.
test('laufender Batch bleibt sichtbar und stoppbar, auch bei Zählerstand 0', () => {
  assert.deepEqual(batchControlState(true, 0), { visible: true, action: 'stop' })
})

test('Rückstand ohne laufenden Batch: sichtbar, Aktion Start', () => {
  assert.deepEqual(batchControlState(false, 3), { visible: true, action: 'start' })
})

test('ohne Rückstand und ohne Batch: kein Kasten', () => {
  assert.deepEqual(batchControlState(false, 0), { visible: false, action: 'start' })
})
