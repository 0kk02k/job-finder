// Dirty-Vertrag der Settings-Seite: „ungespeichert“ heißt echte Differenz
// gegen den geladenen Stand — nie bloß „Felder sind gefüllt“. Regressionsschutz
// für Runde 10 (P1): das geladene Profil hielt die Fläche dauerhaft dirty,
// Banner + beforeunload klebten fest, und der Speichern-Knopf löste es nie.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isProfileDirty, isSettingsDirty, isSettingsFormDirty } from '../../lib/settings-dirty'

const SETTINGS = {
  aiProvider: 'nebius',
  aiModel: 'gpt-4o',
  ollamaUrl: null,
  targetTitles: 'Pflegefachkraft',
  targetLocations: 'Berlin',
  minSalary: 3200,
  docTemplate: 'modern',
  remote: false,
}

const PROFILE = {
  name: 'Alex Muster',
  headline: 'Pflegefachkraft',
  about: 'Erfahrung in der Onkologie.',
  location: 'Berlin',
  skills: 'Wundmanagement, Kommunikation',
}

test('geladenes Profil ohne Änderung ist nicht dirty (der Runde-10-Bug)', () => {
  assert.equal(isProfileDirty(PROFILE, PROFILE), false)
})

test('ohne Profil-Baseline (Profil lädt noch) ist nicht dirty', () => {
  assert.equal(isProfileDirty(PROFILE, null), false)
})

test('eine echte Profil-Änderung ist dirty', () => {
  assert.equal(isProfileDirty({ ...PROFILE, headline: 'Examinierter Pflegefachmann' }, PROFILE), true)
  assert.equal(isProfileDirty({ ...PROFILE, skills: 'Wundmanagement' }, PROFILE), true)
})

test('leeres Profil mit leerer Baseline ist nicht dirty', () => {
  assert.equal(
    isProfileDirty(
      { name: '', headline: '', about: '', location: '', skills: '' },
      { name: '', headline: '', about: '', location: '', skills: '' }
    ),
    false
  )
})

test('unveränderte Fläche mit geladenem Profil ist nicht dauerhaft dirty', () => {
  assert.equal(
    isSettingsDirty({ settings: SETTINGS, baseline: SETTINGS, newKeys: {}, profile: PROFILE, profileBaseline: PROFILE }),
    false
  )
})

test('Profil-Änderung allein macht dirty', () => {
  assert.equal(
    isSettingsDirty({ settings: SETTINGS, baseline: SETTINGS, newKeys: {}, profile: { ...PROFILE, name: 'Alex M.' }, profileBaseline: PROFILE }),
    true
  )
})

test('Settings-Änderung macht dirty', () => {
  assert.equal(
    isSettingsDirty({ settings: { ...SETTINGS, remote: true }, baseline: SETTINGS, newKeys: {}, profile: PROFILE, profileBaseline: PROFILE }),
    true
  )
})

test('neu getippter Schlüssel macht dirty, leerer nicht', () => {
  assert.equal(
    isSettingsDirty({ settings: SETTINGS, baseline: SETTINGS, newKeys: { apify: 'tok' }, profile: PROFILE, profileBaseline: PROFILE }),
    true
  )
  assert.equal(
    isSettingsDirty({ settings: SETTINGS, baseline: SETTINGS, newKeys: { apify: '' }, profile: PROFILE, profileBaseline: PROFILE }),
    false
  )
})

test('Profil-Baseline null hält unveränderte Settings nicht dirty (Ladephase)', () => {
  assert.equal(
    isSettingsDirty({ settings: SETTINGS, baseline: SETTINGS, newKeys: {}, profile: PROFILE, profileBaseline: null }),
    false
  )
})

test('ohne geladene Settings ist nie dirty', () => {
  assert.equal(
    isSettingsDirty({ settings: null, baseline: null, newKeys: {}, profile: PROFILE, profileBaseline: PROFILE }),
    false
  )
})

// Granular für den einen Save-Punkt: er speichert genau die Bereiche, die
// geändert sind — nicht blind beide
test('isSettingsFormDirty rechnet nur die Settings-Fläche (ohne Profil)', () => {
  assert.equal(isSettingsFormDirty(SETTINGS, SETTINGS, {}), false)
  assert.equal(isSettingsFormDirty(SETTINGS, SETTINGS, { apify: 'tok' }), true)
  assert.equal(isSettingsFormDirty({ ...SETTINGS, targetLocations: 'Hamburg' }, SETTINGS, {}), true)
  assert.equal(isSettingsFormDirty(null, SETTINGS, {}), false)
})
