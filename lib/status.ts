// Job-Status: geteilte Labels und die appliedAt-Regel — eine Quelle für die
// Job-Liste, das Job-Detail und die API, statt dreier Kopien der Namen.

export const STATUS_LABELS: Record<string, string> = {
  DISCOVERED: 'Entdeckt',
  SCORED: 'Bewertet',
  HIGH_MATCH: 'Top Match',
  APPLIED: 'Beworben',
  INTERVIEW: 'Gespräch',
  OFFER: 'Angebot',
  REJECTED: 'Abgelehnt',
  ARCHIVED: 'Archiviert',
}

// appliedAt markiert den ersten Bewerbungsversand: gesetzt, wenn eine Stufe
// erreicht wird, die eine versandte Bewerbung voraussetzt (APPLIED, INTERVIEW),
// und danach nie überschrieben — auch ein Rücksprung auf APPLIED löscht den
// ersten Versand nicht.
export function appliedAtFor(nextStatus: string, current: Date | null, now: Date): Date | null {
  if (nextStatus !== 'APPLIED' && nextStatus !== 'INTERVIEW') return current ?? null
  return current ?? now
}
