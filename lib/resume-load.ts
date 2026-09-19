// Resume-Laden: Netzwerk- und Serverfehler sind NICHT „kein Lebenslauf“.
// Vor Runde 10 loggte der Catch nur, und die UI behauptete still „lade deinen
// Lebenslauf hoch“ — der Fehlerzustand mit Retry ist der ehrliche dritte Weg.

export type ResumeLoadState = 'view' | 'upload' | 'error'

export function resumeLoadState(responded: boolean, hasResume: boolean): ResumeLoadState {
  if (!responded) return 'error'
  return hasResume ? 'view' : 'upload'
}
