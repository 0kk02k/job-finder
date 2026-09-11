// Cockpit-Logik: die Ordnung der laufenden Bewerbungen (fällige Wiedervorlage
// zuerst — heute zählt als fällig —, sonst „Beworben am“ absteigend) und die
// Wochen-Kennzahlen aus den ehrlichen Zeitstempeln (appliedAt, rejectedAt).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PIPELINE_STATUSES, collectFollowUps, sortApplications, weekStats } from '../../lib/applications'

interface App {
  id: string
  status: string
  appliedAt: string | null
  rejectedAt?: string | null
  followUpAt: string | null
  createdAt: string
}

const DAY = 24 * 60 * 60 * 1000
// „Heute“ fixiert, damit der Test nicht mit der Uhrzeit jongliert
const TODAY = new Date('2026-09-10T15:00:00Z')

const app = (
  id: string,
  over: Partial<App> = {}
): App => ({
  id,
  status: 'APPLIED',
  appliedAt: new Date(TODAY.getTime() - 5 * DAY).toISOString(),
  followUpAt: null,
  createdAt: new Date(TODAY.getTime() - 10 * DAY).toISOString(),
  ...over,
})

test('pipeline statuses are exactly APPLIED, INTERVIEW, OFFER', () => {
  assert.deepEqual(PIPELINE_STATUSES, ['APPLIED', 'INTERVIEW', 'OFFER'])
})

test('due follow-ups come first, sorted ascending, today counts as due', () => {
  const dueOlder = app('due-older', { followUpAt: new Date(TODAY.getTime() - 2 * DAY).toISOString() })
  const dueTodayEnd = app('due-today', { followUpAt: new Date('2026-09-10T23:59:59Z').toISOString() })
  const future = app('future', { followUpAt: new Date(TODAY.getTime() + 3 * DAY).toISOString() })
  const sorted = sortApplications([future, dueTodayEnd, dueOlder], TODAY)
  assert.deepEqual(sorted.map((a) => a.id), ['due-older', 'due-today', 'future'])
})

test('without due follow-ups, newest application comes first', () => {
  const older = app('older', { appliedAt: new Date(TODAY.getTime() - 20 * DAY).toISOString() })
  const newer = app('newer', { appliedAt: new Date(TODAY.getTime() - 2 * DAY).toISOString() })
  const sorted = sortApplications([older, newer], TODAY)
  assert.deepEqual(sorted.map((a) => a.id), ['newer', 'older'])
})

test('a future follow-up sorts by application date, not by its own date', () => {
  const olderWithFutureFollowUp = app('older-fu', {
    appliedAt: new Date(TODAY.getTime() - 30 * DAY).toISOString(),
    followUpAt: new Date(TODAY.getTime() + 10 * DAY).toISOString(),
  })
  const newer = app('newer', { appliedAt: new Date(TODAY.getTime() - 2 * DAY).toISOString() })
  const sorted = sortApplications([olderWithFutureFollowUp, newer], TODAY)
  assert.deepEqual(sorted.map((a) => a.id), ['newer', 'older-fu'])
})

test('never-applied applications sort by discovery date, last', () => {
  const applied = app('applied', { appliedAt: new Date(TODAY.getTime() - 2 * DAY).toISOString() })
  const discoveredLongAgo = app('discovered-old', {
    appliedAt: null,
    createdAt: new Date(TODAY.getTime() - 40 * DAY).toISOString(),
  })
  const discoveredRecent = app('discovered-new', {
    appliedAt: null,
    createdAt: new Date(TODAY.getTime() - 4 * DAY).toISOString(),
  })
  const sorted = sortApplications([discoveredLongAgo, applied, discoveredRecent], TODAY)
  assert.deepEqual(sorted.map((a) => a.id), ['applied', 'discovered-new', 'discovered-old'])
})

test('weekStats counts applications and rejections from their own timestamps', () => {
  const jobs = [
    app('a', { appliedAt: new Date(TODAY.getTime() - 1 * DAY).toISOString() }), // diese Woche
    app('b', { appliedAt: new Date(TODAY.getTime() - 20 * DAY).toISOString() }), // älter
    {
      ...app('c', { appliedAt: new Date(TODAY.getTime() - 2 * DAY).toISOString() }),
      status: 'REJECTED',
      rejectedAt: new Date(TODAY.getTime() - 3 * DAY).toISOString(), // diese Woche abgesagt
    },
    {
      ...app('d', { appliedAt: null }),
      status: 'REJECTED',
      rejectedAt: new Date(TODAY.getTime() - 30 * DAY).toISOString(), // Absage liegt länger zurück
    },
  ]
  const weekAgo = new Date(TODAY.getTime() - 7 * DAY)
  assert.deepEqual(weekStats(jobs, weekAgo), {
    appliedThisWeek: 2, // a + c (c ist beworben UND abgesagt)
    rejectedThisWeek: 1, // nur c
    interviews: 0,
    offers: 0,
  })
})

test('collectFollowUps lists only set dates, oldest first — overdue on top', () => {
  const withoutDate = app('no-date')
  const upcoming = app('upcoming', { followUpAt: new Date(TODAY.getTime() + 5 * DAY).toISOString() })
  const overdue = app('overdue', { followUpAt: new Date(TODAY.getTime() - 1 * DAY).toISOString() })
  const collected = collectFollowUps([withoutDate, upcoming, overdue])
  assert.deepEqual(collected.map((a) => a.id), ['overdue', 'upcoming'])
})

test('weekStats counts standing interviews and offers regardless of week', () => {
  const jobs = [
    { ...app('i'), status: 'INTERVIEW', appliedAt: new Date(TODAY.getTime() - 30 * DAY).toISOString() },
    { ...app('o'), status: 'OFFER', appliedAt: new Date(TODAY.getTime() - 40 * DAY).toISOString() },
  ]
  const stats = weekStats(jobs, new Date(TODAY.getTime() - 7 * DAY))
  assert.equal(stats.interviews, 1)
  assert.equal(stats.offers, 1)
  assert.equal(stats.appliedThisWeek, 0)
})
