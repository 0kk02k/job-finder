// Dirty-Entscheidung der Settings-Seite — rein und client-sicher (getestet in
// tests/lib/settings-dirty.test.ts). „Dirty“ heißt: echte Differenz gegen den
// geladenen Stand — nie bloß „Felder sind gefüllt“. Vor Runde 10 rechnete der
// Profil-Vergleich gegen '', sodass jedes geladene Profil die Fläche dauerhaft
// dirty hielt: Banner klebte, beforeunload nagte, Speichern löste es nie.

export interface SettingsFormFields {
  aiProvider: string
  aiModel: string | null
  docTemplate: string | null
  ollamaUrl: string | null
  targetTitles: string | null
  targetLocations: string | null
  minSalary: number | null
  remote: boolean
}

// Profil-Felder, wie die Seite sie führt (bereits zu Strings geglättet)
export interface ProfileFormFields {
  name: string
  headline: string
  about: string
  location: string
  skills: string
}

export const EMPTY_PROFILE_FIELDS: ProfileFormFields = {
  name: '',
  headline: '',
  about: '',
  location: '',
  skills: '',
}

// Ohne Baseline (Profil lädt noch oder schlug fehl) gilt: nicht dirty —
// der Guard soll nie gegen Felder scharf stehen, die noch nicht da sind.
export function isProfileDirty(current: ProfileFormFields, baseline: ProfileFormFields | null): boolean {
  if (!baseline) return false
  return (
    current.name !== baseline.name ||
    current.headline !== baseline.headline ||
    current.about !== baseline.about ||
    current.location !== baseline.location ||
    current.skills !== baseline.skills
  )
}

// Nur die Settings-Fläche (Formularfelder + frisch getippte Schlüssel) — für
// den einen Save-Punkt, der genau die Bereiche speichert, die geändert sind
export function isSettingsFormDirty(
  settings: SettingsFormFields | null,
  baseline: SettingsFormFields | null,
  newKeys: object
): boolean {
  if (!settings || !baseline) return false
  // NewKeys hat feste Props ohne Index-Signatur — für Object.values genügt object
  const values = Object.values(newKeys) as string[]
  return (
    settings.aiProvider !== baseline.aiProvider ||
    (settings.aiModel ?? '') !== (baseline.aiModel ?? '') ||
    (settings.docTemplate ?? '') !== (baseline.docTemplate ?? '') ||
    (settings.ollamaUrl ?? '') !== (baseline.ollamaUrl ?? '') ||
    (settings.targetTitles ?? '') !== (baseline.targetTitles ?? '') ||
    (settings.targetLocations ?? '') !== (baseline.targetLocations ?? '') ||
    (settings.minSalary ?? null) !== (baseline.minSalary ?? null) ||
    settings.remote !== baseline.remote ||
    values.some((value) => value !== '')
  )
}

export function isSettingsDirty(input: {
  settings: SettingsFormFields | null
  baseline: SettingsFormFields | null
  newKeys: object
  profile: ProfileFormFields
  profileBaseline: ProfileFormFields | null
}): boolean {
  const { settings, baseline, newKeys, profile, profileBaseline } = input
  if (!settings || !baseline) return false
  return (
    isSettingsFormDirty(settings, baseline, newKeys) ||
    isProfileDirty(profile, profileBaseline)
  )
}
