// Ordnungsfunktionen für den semantischen Suchfluss (Query-Fächer, Pool-Merge,
// Zweitrunde mit fuzzyMatches). Rein und unit-testbar — das Fetchen selbst bleibt
// in lib/scrapers.ts, das Ranken in lib/ai.ts.

function normalized(s: string): string {
  return s.trim().toLowerCase()
}

// Aus den KI-Alternativbegriffen wird der Fächer: getrimmt, ohne Leeres, ohne
// Duplikate der Original-Query und untereinander, gekappt auf max Varianten.
// Sie laufen parallel MIT zur Original-Query — mehr Recall, keine längere Suche.
export function pickQueryFan(queries: string[], original: string, max: number): string[] {
  const seen = new Set([normalized(original)])
  const fan: string[] = []
  for (const raw of queries) {
    if (typeof raw !== 'string') continue
    const query = raw.trim()
    if (!query) continue
    if (seen.has(normalized(query))) continue
    seen.add(normalized(query))
    fan.push(query)
    if (fan.length >= max) break
  }
  return fan
}

// Mehrere Quell-Pools (Original + Fächer) werden in Reihenfolge zusammengeführt:
// der erste Treffer einer URL gewinnt, URL-lose Einträge fallen weg.
export function mergeJobsByUrl<T extends { url: string }>(pools: T[][]): T[] {
  const seen = new Set<string>()
  const merged: T[] = []
  for (const pool of pools) {
    for (const job of pool) {
      if (!job.url || seen.has(job.url)) continue
      seen.add(job.url)
      merged.push(job)
    }
  }
  return merged
}

// Zweitrunde: die fuzzyMatches des Rankings lösen einen zweiten Fetch aus —
// aber nur mit Begriffen, die noch nicht gefetcht wurden, gekappt auf max.
export function pickFuzzyTerms(fuzzy: string[], usedQueries: string[], max: number): string[] {
  const seen = new Set(usedQueries.map(normalized))
  const terms: string[] = []
  for (const raw of fuzzy) {
    if (typeof raw !== 'string') continue
    const term = raw.trim()
    if (!term) continue
    if (seen.has(normalized(term))) continue
    seen.add(normalized(term))
    terms.push(term)
    if (terms.length >= max) break
  }
  return terms
}

// Feste Parallelität statt unbegrenztem Promise.all: 50 gleichzeitige KI-Calls
// erzeugen am Provider Rate-Limit-Staus, aus denen der Suchlauf nicht
// rechtzeitig zurückkehrt. Ergebnisse bleiben reihengetreu (Index = Eingabe).
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker()))
  return results
}
