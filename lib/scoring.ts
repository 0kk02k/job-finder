// Scoring auf Abruf — dieselben Regeln wie im Suchfluss (app/api/search/route.ts):
// Status aus der High-Match-Schwelle, Match-Details als JSON im Job. Hier ausgelagert,
// damit Einzelscore und Batch exakt dasselbe Persistenzverhalten haben wie die Suche
// und testbar sind, ohne die Route zu brauchen.

export interface ScoreInput {
  score: number
  reason: string
  strengths?: string[]
  gaps?: string[]
}

export interface ScoreUpdatePayload {
  score: number
  scoreReason: string
  matchDetails: string
  status: 'HIGH_MATCH' | 'SCORED'
}

export function scoreUpdatePayload(input: ScoreInput, highMatchThreshold: number): ScoreUpdatePayload {
  return {
    score: input.score,
    scoreReason: input.reason,
    matchDetails: JSON.stringify({ strengths: input.strengths ?? [], gaps: input.gaps ?? [] }),
    status: input.score >= highMatchThreshold ? 'HIGH_MATCH' : 'SCORED',
  }
}

interface BatchCandidate {
  id: string
  score: number | null
  createdAt: Date | string
}

// Der Rückstand in Bearbeitungsreihenfolge: unbewertet, der am längsten Wartende zuerst.
// Bewusst ohne Pipeline-Ausschluss — auch ein schon beworbener Job ohne Score bekommt
// sonst nie eine Bewertung (App/Kontrolle-Prinzip: der Nutzer entscheidet über Reihenfolge).
export function pickUnscoredBatch<T extends BatchCandidate>(jobs: T[], limit: number): T[] {
  return jobs
    .filter((job) => job.score == null)
    .sort(
      (a, b) =>
        (typeof a.createdAt === 'string' ? Date.parse(a.createdAt) : a.createdAt.getTime()) -
        (typeof b.createdAt === 'string' ? Date.parse(b.createdAt) : b.createdAt.getTime())
    )
    .slice(0, limit)
}
