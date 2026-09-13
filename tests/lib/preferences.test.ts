// Das Präferenz-Gespräch lebt und stirbt mit seiner Reinheit: Ein Profil, das
// etwas behauptet, das der Nutzer nie gesagt hat, verfälscht still jede Job-
// bewertung. Getestet wird deshalb der Sanitizing- und Rendering-Vertrag — die
// KI selbst ist außen vor (lokal kein Key).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PREFERENCE_GUIDE,
  PREFERENCE_OPENING_MESSAGE,
  condensePreferenceProfile,
  filterVerifiedEvidence,
  parseStoredProfile,
  renderPreferenceBlock,
  sanitizePreferenceProfile,
} from '../../lib/preferences'
import type { PreferenceProfile } from '../../lib/preferences'

function validProfile(overrides: Partial<PreferenceProfile> = {}): PreferenceProfile {
  return {
    version: 1,
    enjoys: 'Architektur-Entscheidungen und das Mentoring von Junioren',
    criteria: [
      { topic: 'Tech-Stack', weight: 'hoch', note: 'moderner JS-Stack' },
      { topic: 'Team', weight: 'mittel', note: '' },
      { topic: 'Gehalt', weight: 'niedrig', note: '' },
    ],
    avoids: ['Bereitschaftsdienst'],
    growth: 'Mehr Backend und Führung in den nächsten 2–3 Jahren',
    summary: 'Erfahrener Frontend-Dev mitBackend-Ambitionen, legt Wert auf modernen Stack.',
    keywords: ['Frontend', 'React', 'Tech Lead'],
    ...overrides,
  }
}

test('PREFERENCE_GUIDE has exactly the four topics with unique ids and criteria', () => {
  assert.equal(PREFERENCE_GUIDE.length, 4)
  assert.deepEqual(
    PREFERENCE_GUIDE.map((i) => i.id),
    ['enjoy', 'weights', 'avoid', 'growth']
  )
  for (const item of PREFERENCE_GUIDE) {
    assert.ok(item.topic.length > 0, `topic fehlt bei ${item.id}`)
    assert.ok(item.criteria.length > 0, `criteria fehlen bei ${item.id}`)
    assert.ok(item.category.length > 0, `category fehlt bei ${item.id}`)
  }
  // Die Opening-Message benennt dieselbe Zahl Themen — was sie verspricht,
  // muss die Checkliste halten.
  assert.ok(PREFERENCE_OPENING_MESSAGE.includes('vier Themen'))
})

test('sanitizePreferenceProfile trims, caps lengths, and fixes invalid weights', () => {
  const manyCriteria = Array.from({ length: 12 }, (_, i) => ({
    topic: `Kriterium ${i}`,
    weight: 'wichtig',
    note: 'x'.repeat(300),
  }))
  const raw = {
    enjoys: '  Spaß am Bauen  ',
    criteria: manyCriteria,
    avoids: Array.from({ length: 9 }, (_, i) => `No-Go ${i}`),
    growth: 'w'.repeat(500),
    summary: 's'.repeat(400),
    keywords: Array.from({ length: 12 }, (_, i) => `kwd${i}`),
    version: 99,
    hack: 'fremdes Feld',
  }
  const profile = sanitizePreferenceProfile(raw)
  assert.ok(profile, 'gültiges Rohprofil darf nicht verworfen werden')
  assert.equal(profile!.version, 1)
  assert.equal(profile!.enjoys, 'Spaß am Bauen')
  assert.equal(profile!.criteria.length, 8)
  assert.equal(profile!.criteria[0].weight, 'mittel', 'unbekanntes Gewicht fällt auf mittel')
  assert.equal(profile!.criteria[0].note.length, 200)
  assert.ok(profile!.criteria.every((c) => c.topic.length <= 60))
  assert.equal(profile!.avoids.length, 5)
  assert.equal(profile!.growth.length, 400)
  assert.equal(profile!.summary.length, 300)
  assert.equal(profile!.keywords.length, 8)
  assert.equal((profile as unknown as Record<string, unknown>).hack, undefined)
})

test('sanitizePreferenceProfile drops empty criteria and rejects hollow profiles', () => {
  const sparse = sanitizePreferenceProfile({
    enjoys: '',
    criteria: [{ topic: '', weight: 'hoch', note: '' }, { topic: 'Remote', weight: 'hoch', note: 'nur 2 Tage Präsenz' }],
    avoids: ['   ', ''],
    growth: '',
    summary: '',
    keywords: [],
  })
  assert.ok(sparse)
  assert.deepEqual(sparse!.criteria, [{ topic: 'Remote', weight: 'hoch', note: 'nur 2 Tage Präsenz' }])
  assert.deepEqual(sparse!.avoids, [])

  // Gar nichts Substanzielles ist kein Profil — null, nie ein leeres Objekt.
  assert.equal(sanitizePreferenceProfile({}), null)
  assert.equal(sanitizePreferenceProfile('nix'), null)
  assert.equal(sanitizePreferenceProfile(['ein', 'array']), null)
  assert.equal(sanitizePreferenceProfile(null), null)
  assert.equal(
    sanitizePreferenceProfile({ criteria: [{ topic: '', weight: 'hoch', note: '' }] }),
    null,
    'nur leere Kriterien tragen kein Profil'
  )
  // Ein einziges echtes Kriterium ist ein minimales, aber ehrliches Profil.
  assert.ok(sanitizePreferenceProfile({ criteria: [{ topic: 'Remote', weight: 'hoch', note: '' }] }))
})

test('parseStoredProfile accepts JSON and returns null for garbage', () => {
  const profile = parseStoredProfile(JSON.stringify(validProfile()))
  assert.ok(profile)
  assert.equal(profile!.enjoys, validProfile().enjoys)
  assert.equal(parseStoredProfile('kein json'), null)
  assert.equal(parseStoredProfile(''), null)
  assert.equal(parseStoredProfile(null), null)
  assert.equal(parseStoredProfile(undefined), null)
})

test('renderPreferenceBlock contains the user’s own words and every weight label', () => {
  const block = renderPreferenceBlock(
    validProfile({ criteria: [
      { topic: 'Tech-Stack', weight: 'hoch', note: 'moderner JS-Stack' },
      { topic: 'Remote', weight: 'mittel', note: 'nur 2 Tage Präsenz' },
    ] })
  )
  assert.ok(block.includes('Architektur-Entscheidungen'), 'enjoys wörtlich')
  assert.ok(block.includes('Tech-Stack (hoch)'))
  assert.ok(block.includes('Remote (mittel)'))
  assert.ok(block.includes('moderner JS-Stack'))
  assert.ok(block.includes('nur 2 Tage Präsenz'))
  assert.ok(block.includes('Bereitschaftsdienst'))
  assert.ok(block.includes('Mehr Backend und Führung'))
  assert.ok(!block.includes('undefined'), 'leere notes dürfen nicht als Text landen')
  // Deterministisch: gleiche Eingabe, gleiche Ausgabe (Cache-Präfix-Vertrag).
  const again = renderPreferenceBlock(validProfile())
  assert.equal(again, renderPreferenceBlock(validProfile()))
})

test('condensePreferenceProfile respects maxChars and leaks nothing on empty fields', () => {
  const dense = condensePreferenceProfile(validProfile(), 80)
  assert.ok(dense.length <= 80)
  const hollow = condensePreferenceProfile(
    validProfile({ enjoys: '', criteria: [], avoids: [], growth: '', summary: '', keywords: [] }),
    500
  )
  assert.ok(!hollow.includes('undefined'))
  assert.ok(!hollow.includes('null'))
  // Die Kompaktversion trägt die hoch gewichteten Kriterien — genau dafür ist sie da.
  const full = condensePreferenceProfile(validProfile(), 500)
  assert.ok(full.includes('Tech-Stack'))
  assert.ok(full.includes('Meidet'))
})

test('filterVerifiedEvidence keeps only verbatim, attributed, known evidence', () => {
  const history = 'KANDIDAT: Frontend macht mir Spaß, aber ich will\n  mehr Backend. Und Bereitschaftsdienst ist ein No-Go.\n\nINTERVIEWER: Verstanden.'
  const result = filterVerifiedEvidence(
    [
      { id: 'enjoy', evidence: 'Frontend macht mir Spaß' },
      { id: 'weights', evidence: 'ICH WILL MEHR\n  BACKEND' },
      { id: 'avoid', evidence: 'Bereitschaftsdienst ist ein No-Go.' },
      { id: 'growth', evidence: 'Ich erfinde jetzt etwas über Cloud-Karriere' },
      { id: 'fremd', evidence: 'Frontend macht mir Spaß' },
      { id: 'enjoy', evidence: 'Frontend macht mir Spaß' },
      { id: 'avoid', evidence: 'kurz' },
      'mist',
    ],
    ['enjoy', 'weights', 'avoid', 'growth'],
    history
  )
  // enjoy: wörtlich ✓ · weights: Case/Whitespace normalisiert ✓ · avoid ✓
  // growth: erfunden ✗ · fremde ID ✗ · Duplikat einmal · zu kurz ✗
  assert.deepEqual(result, ['enjoy', 'weights', 'avoid'])
})

test('filterVerifiedEvidence handles a non-array response and empty history', () => {
  assert.deepEqual(filterVerifiedEvidence('mist', ['enjoy'], 'x'), [])
  assert.deepEqual(filterVerifiedEvidence([{ id: 'enjoy', evidence: 'irgendein Beleg hier' }], ['enjoy'], ''), [])
})

// Kleine Modelle paraphrasieren und kürzen beim Zitieren systematisch — ein
// Beleg geht durch, wenn ≥80% seiner Wort-Token im Transkript stehen.
test('filterVerifiedEvidence accepts paraphrased evidence with sufficient token overlap', () => {
  const history = 'NUTZER: Remote-Arbeit ist mir sehr wichtig, weil ich zwei Kinder habe und die Kita-Zeiten eng sind. Bereitschaftsdienst scheidet für mich aus.\n\nBERATERIN: Danke, das ist klar.'
  const result = filterVerifiedEvidence(
    [
      // Paraphrase: ein Wort ersetzt (Kids statt Kinder), Wortstellung leicht anders
      { id: 'weights', evidence: 'weil ich zwei Kids habe und die Kita-Zeiten eng sind' },
      // Gekürzt mit Auslassung: "…" bricht den wörtlichen Substring, Token bleiben
      { id: 'avoid', evidence: 'Bereitschaftsdienst scheidet … aus' },
    ],
    ['weights', 'avoid'],
    history
  )
  assert.deepEqual(result, ['weights', 'avoid'])
})

test('filterVerifiedEvidence rejects invented evidence and token-poor filler fuzzily', () => {
  const history = 'NUTZER: Remote-Arbeit ist mir sehr wichtig, weil ich zwei Kinder habe und die Kita-Zeiten eng sind.'
  // Erfunden: fast alle Token kommen im Transkript nicht vor
  assert.deepEqual(
    filterVerifiedEvidence(
      [{ id: 'growth', evidence: 'Ich träume von einer Cloud-Karriere in München mit Führung' }],
      ['growth'],
      history
    ),
    []
  )
  // Füllwörter-Spruch: nur 2 unterscheidende Token — zu dünn für die Fuzzy-Quote
  // (stünde er wörtlich im Transkript, ginge er über den Substring-Pfad durch)
  assert.deepEqual(
    filterVerifiedEvidence(
      [{ id: 'weights', evidence: 'wichtig, sehr wichtig' }],
      ['weights'],
      history
    ),
    []
  )
})
