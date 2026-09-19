// Resume-Laden: Netzwerk- und Serverfehler sind NICHT „kein Lebenslauf“ —
// sie führen in einen Fehlerzustand mit Retry, nie still in den Upload-Modus
// (Runde 10, P2).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resumeLoadState } from '../../lib/resume-load'

test('gespeicherter Lebenslauf → Ansicht', () => {
  assert.equal(resumeLoadState(true, true), 'view')
})

test('ehrlich ohne Lebenslauf → Upload-Modus', () => {
  assert.equal(resumeLoadState(true, false), 'upload')
})

test('Server-/Netzwerkfehler → Fehlerzustand, nicht Upload', () => {
  assert.equal(resumeLoadState(false, false), 'error')
  assert.equal(resumeLoadState(false, true), 'error')
})
