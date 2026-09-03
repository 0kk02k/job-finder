// Eine Schwelle, alle Flächen: High Match beginnt ab KI-Score 8 —
// synchron zum Scoring-Prompt in lib/ai.ts („8+ bedeutet sehr guter Fit",
// „6–7 guter Fit mit kleinen Lücken"). Bewusst in einer eigenen Datei ohne
// Imports: lib/ai.ts zieht das AI-SDK in den Client-Bundle, wenn die UI
// die Konstante von dort beziehen würde.
export const HIGH_MATCH_THRESHOLD = 8

// Zum Score gehörende Wörter — Bedeutung als Text getragen, nicht nur als Farbe
// (WCAG 1.4.1): Screenreader hören das Urteil, nicht nur „9 von 10".
export function scoreLabel(score: number): string {
  if (score >= HIGH_MATCH_THRESHOLD) return 'sehr gutes Matching'
  if (score >= 6) return 'gutes Matching mit Lücken'
  return 'wenig Passung'
}
