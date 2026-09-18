// Die Praxisaufgabe ist der einzige IT-verankerte Teil des HR-Interviews.
// Vertrag an den Katalog: Aufgabentypen müssen für jede Fachrichtung
// funktionieren, Technik-Beispiele nur für technische Profile.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MINI_TASK_CATALOG,
  INTERVIEW_GUIDE,
  agendaItemsCoveredByProfile,
  agendaItemsCoveredByAnecdotes,
  coveredAgendaIds,
  buildInterviewContextBlock,
  buildInsightsAnecdoteBlock,
  anecdoteFromRow,
  type AnecdoteRef,
} from '../../lib/interview'
import type { PreferenceProfile } from '../../lib/preference-profile'

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

// --- Zwei-Phasen-Dedupe: Was das Präferenz-Gespräch klärt, fragt das
//     Interview nicht erneut. Getestet wird die deterministische Zuordnung —
//     kein LLM nötig. ---------------------------------------------

const profile = (over: Partial<PreferenceProfile> = {}): PreferenceProfile => ({
  version: 1,
  enjoys: '',
  criteria: [],
  avoids: [],
  growth: '',
  summary: '',
  keywords: [],
  ...over,
})

test('coverage rules reference only real agenda ids', () => {
  const ids = new Set(INTERVIEW_GUIDE.map((i) => i.id))
  const full = profile({
    enjoys: 'Architektur',
    criteria: [
      { topic: 'Remote', weight: 'hoch', note: '' },
      { topic: 'Team', weight: 'mittel', note: '' },
    ],
    growth: 'Führung',
  })
  for (const id of coveredAgendaIds(full, [])) {
    assert.ok(ids.has(id), `unbekannte Agenda-ID: ${id}`)
  }
})

test('profile without substance covers nothing', () => {
  assert.deepEqual(agendaItemsCoveredByProfile(null), [])
  assert.deepEqual(agendaItemsCoveredByProfile(profile()), [])
})

test('growth or enjoys cover the change-motivation topic', () => {
  assert.deepEqual(agendaItemsCoveredByProfile(profile({ growth: 'Mehr Verantwortung' })), [
    'motivation-change',
  ])
  assert.deepEqual(agendaItemsCoveredByProfile(profile({ enjoys: 'Konzeption' })), [
    'motivation-change',
  ])
  assert.deepEqual(
    agendaItemsCoveredByProfile(profile({ criteria: [{ topic: 'Remote', weight: 'hoch', note: '' }] })),
    []
  )
})

test('weighted criteria cover the next-role goals topic — one is not enough', () => {
  const one = profile({ criteria: [{ topic: 'Remote', weight: 'hoch', note: '' }] })
  const two = profile({
    criteria: [
      { topic: 'Remote', weight: 'hoch', note: '' },
      { topic: 'Team', weight: 'mittel', note: '' },
    ],
  })
  assert.deepEqual(agendaItemsCoveredByProfile(one), [])
  assert.deepEqual(agendaItemsCoveredByProfile(two), ['goals-next-role'])
})

// --- Anekdoten als STAR-Rohmaterial ---------------------------------------

const anecdote = (title: string, skills: string[] = []): AnecdoteRef => ({
  id: `id-${title}`,
  title,
  situation: 'S',
  action: 'A',
  result: 'R',
  skills,
})

test('no anecdotes means no coverage — STAR questions stay as before', () => {
  assert.deepEqual(agendaItemsCoveredByAnecdotes(null), [])
  assert.deepEqual(agendaItemsCoveredByAnecdotes([]), [])
})

test('anecdotes cover the strength topics one by one', () => {
  assert.deepEqual(agendaItemsCoveredByAnecdotes([anecdote('Erfolg')]), ['strength-1'])
  assert.deepEqual(
    agendaItemsCoveredByAnecdotes([anecdote('Erfolg'), anecdote('Ehrung')]),
    ['strength-1', 'strength-2']
  )
})

test('conflict and pressure signals cover the behavioural topics', () => {
  const conflict = anecdote('Vermittelter Teamkonflikt', ['Konfliktfähigkeit'])
  const pressure = anecdote('Release unter Zeitdruck', ['Priorisierung'])
  assert.deepEqual(
    agendaItemsCoveredByAnecdotes([anecdote('A'), anecdote('B'), conflict]),
    ['strength-1', 'strength-2', 'teamwork-conflict']
  )
  assert.deepEqual(
    agendaItemsCoveredByAnecdotes([anecdote('A'), anecdote('B'), pressure]),
    ['strength-1', 'strength-2', 'pressure-priorities']
  )
})

test('coveredAgendaIds merges profile and anecdotes without duplicates', () => {
  const p = profile({ growth: 'Weiterbildung', criteria: [
    { topic: 'Remote', weight: 'hoch', note: '' },
    { topic: 'Team', weight: 'mittel', note: '' },
  ] })
  const covered = coveredAgendaIds(p, [anecdote('A'), anecdote('B')])
  assert.deepEqual(
    [...covered].sort(),
    ['goals-next-role', 'motivation-change', 'strength-1', 'strength-2']
  )
})

// --- Kontextblock im Gesprächs-Prompt --------------------------------------

test('context block stays empty without profile and anecdotes — prompt unchanged', () => {
  assert.equal(buildInterviewContextBlock({}), '')
  assert.equal(buildInterviewContextBlock({ preferenceProfile: null, anecdotes: [] }), '')
})

test('context block renders the profile as already-clarified — not to be re-asked', () => {
  const p = profile({
    enjoys: 'Konzeption',
    criteria: [{ topic: 'Remote', weight: 'hoch', note: 'zweimal pro Woche' }],
    growth: 'Führung',
  })
  const block = buildInterviewContextBlock({ preferenceProfile: p })
  assert.match(block, /BEREITS GEKLÄRT/)
  assert.match(block, /Konzeption/)
  assert.match(block, /Remote \(hoch\)/)
  assert.match(block, /NICHT erneut/)
})

test('context block carries anecdotes as STAR material', () => {
  const block = buildInterviewContextBlock({ anecdotes: [anecdote('Rettung im Eilverfahren')] })
  assert.match(block, /WAHRE ANEKDOTEN/)
  assert.match(block, /Rettung im Eilverfahren/)
  assert.match(block, /STAR/)
})

// --- Anekdoten in der Auswertung (starExample bleibt das Feld) -------------

test('insights block is empty without anecdotes', () => {
  assert.equal(buildInsightsAnecdoteBlock(null), '')
  assert.equal(buildInsightsAnecdoteBlock([]), '')
})

test('insights block allows anecdote-backed starExamples for skipped topics', () => {
  const block = buildInsightsAnecdoteBlock([anecdote('Rettung im Eilverfahren')])
  assert.match(block, /Beleg-Material/)
  assert.match(block, /Rettung im Eilverfahren/)
  assert.match(block, /starExample/)
})

// --- Prisma-Zeile → Prompt-Referenz -----------------------------------------

test('anecdoteFromRow parses the skills json and survives garbage', () => {
  const ref = anecdoteFromRow({
    id: 'a1',
    title: 'T',
    situation: 'S',
    action: 'A',
    result: 'R',
    skills: '["Druckresistenz", "Teamfähigkeit"]',
  })
  assert.deepEqual(ref.skills, ['Druckresistenz', 'Teamfähigkeit'])
  const broken = anecdoteFromRow({ id: 'a2', title: 'T', situation: 'S', action: 'A', result: 'R', skills: '{kein json' })
  assert.deepEqual(broken.skills, [])
})

// --- finish:true-Vertrag: offene Themen zählen, was nicht abgehakt ist -----

test('open topics are the guide items not marked done — pre-cleared ones do not count', () => {
  const completed = coveredAgendaIds(
    profile({ growth: 'Weiterbildung', criteria: [
      { topic: 'Remote', weight: 'hoch', note: '' },
      { topic: 'Team', weight: 'mittel', note: '' },
    ] }),
    [anecdote('A'), anecdote('B')]
  )
  const open = INTERVIEW_GUIDE.filter((i) => !completed.includes(i.id)).map((i) => i.topic)
  assert.ok(!open.some((t) => /Antrieb|Ziele|Stärke/.test(t)), 'geklärte Themen dürfen nicht offen zählen')
  assert.ok(open.some((t) => /Schwäche/.test(t)), 'Interview-Themen bleiben offen')
  assert.ok(open.some((t) => /Mini-Aufgabe/.test(t)), 'Mini-Aufgabe bleibt offen')
})
