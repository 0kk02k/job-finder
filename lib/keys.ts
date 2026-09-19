// API-Key-Hinweise der Settings-Seite — rein und client-sicher (getestet in
// tests/lib/keys.test.ts). Zur Laufzeit fängt die Umgebung (Vercel) ohnehin
// auf, wenn kein Nutzer-Key existiert (getAIClient, Suchroute) — die Settings
// melden das jetzt, statt „nicht hinterlegt" zu behaupten. Vorrang bleibt:
// eigenes Feld schlägt Umgebung. Klartext verlässt den Server nie.

export type KeySource = 'user' | 'env'

export function maskKey(value: string | null | undefined): string | null {
  if (!value) return null
  return `••••${value.slice(-4)}`
}

export function resolveKeyHint(
  userKey: string | null | undefined,
  envKey: string | null | undefined
): { hint: string | null; source: KeySource | null } {
  if (userKey?.trim()) return { hint: maskKey(userKey), source: 'user' }
  if (envKey?.trim()) return { hint: maskKey(envKey), source: 'env' }
  return { hint: null, source: null }
}

export function keyPlaceholder(
  hint: string | null | undefined,
  source: KeySource | null | undefined,
  emptyText: string = 'Noch kein Schlüssel hinterlegt'
): string {
  if (!hint) return emptyText
  return source === 'env'
    ? `Hinterlegt (Umgebung): ${hint} — eigenes Feld überschreibt sie`
    : `Bereits hinterlegt: ${hint} — zum Behalten leer lassen`
}
