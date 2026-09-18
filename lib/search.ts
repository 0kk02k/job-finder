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

// Reicht die Restfrist für eine Phase mit eigener Fetch-Welle (~35s Worst Case:
// alle Quellen parallel plus BA-Details)? Zweitrunde und klassischer Fall-through
// starten nur dann — sonst tragen sie den Lauf ans 60s-Kill-Limit, statt
// Teilergebnisse zu liefern. Derselbe Richtwert, dem die Zweitrunde folgt.
export function phaseFitsInBudget(deadline: number | undefined, now: number = Date.now()): boolean {
  return !deadline || now < deadline - 35_000
}

// Live-Strom aus der Fläche: Ranking-Chunks liefern ihre Treffer einzeln, die
// Fläche hängt sie an ihre Liste. Nachfassen derselben URL ersetzt (die result-
// Zeile wiederholt den Strom als Gesamtpaket), URL-lose fallen weg.
export function mergeStreamedJobs<T extends { url: string }>(existing: readonly T[], incoming: readonly T[]): T[] {
  const byUrl = new Map(existing.map(job => [job.url, job]))
  for (const job of incoming) {
    if (!job.url) continue
    byUrl.set(job.url, job)
  }
  return [...byUrl.values()]
}

// Wie viele Treffer einer Suche die KI pro Lauf bewertet — Reste drainiert der
// nächtliche Cron (/api/cron/score). Ein Ort, weil die Fläche die Zahl im
// Interface benennt (app/search/page.tsx) und die Route sie durchsetzt.
export const SCORE_LIMIT = 50

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
