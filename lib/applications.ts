// Cockpit-Logik für /applications — bewusst reine Funktionen: die Ordnung der
// laufenden Bewerbungen und die Wochen-Kennzahlen sind testbar, ohne Route oder DB.

export const PIPELINE_STATUSES = ['APPLIED', 'INTERVIEW', 'OFFER'] as const

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number]

export interface StatsJob {
  status: string
  appliedAt: string | null
  rejectedAt?: string | null
}

export interface ApplicationRow extends StatsJob {
  id: string
  followUpAt: string | null
  createdAt: string
}

// Kalendertag als UTC-Tag: Date-Inputs liefern yyyy-mm-dd und werden als
// Mitternacht UTC gespeichert — der Vergleich auf Tagesebene bleibt damit
// deterministisch, ohne lokale Zeitzonen-Arithmetik.
function dayOf(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

// Exportiert für die Fläche: dasselbe „fällig“ wie in der Sortierung —
// heute zählt als fällig, ohne lokale Zeitzonen-Arithmetik.
export function isDue(followUpAt: string | null, now: Date): boolean {
  if (!followUpAt) return false
  return dayOf(new Date(followUpAt)) <= dayOf(now)
}

// Fällige Wiedervorlagen zuerst (ältester Termin oben — heute zählt als fällig),
// dann „Beworben am“ absteigend; nie Beworbenes zuletzt, nach „Gefunden am“.
export function sortApplications<T extends ApplicationRow>(apps: T[], now: Date): T[] {
  return [...apps].sort((a, b) => {
    const dueA = isDue(a.followUpAt, now)
    const dueB = isDue(b.followUpAt, now)
    if (dueA !== dueB) return dueA ? -1 : 1
    if (dueA && dueB) {
      return new Date(a.followUpAt!).getTime() - new Date(b.followUpAt!).getTime()
    }
    if (a.appliedAt && b.appliedAt) {
      return Date.parse(b.appliedAt) - Date.parse(a.appliedAt)
    }
    if (a.appliedAt) return -1
    if (b.appliedAt) return 1
    return Date.parse(b.createdAt) - Date.parse(a.createdAt)
  })
}

// Die Termin-Übersicht im Cockpit: alle gesetzten Wiedervorlagen, aufsteigend —
// Überfälliges steht damit automatisch oben, ein eigener „fällig“-Zweig ist unnötig.
export function collectFollowUps<T extends { followUpAt: string | null }>(
  apps: T[]
): (T & { followUpAt: string })[] {
  return apps
    .filter((a): a is T & { followUpAt: string } => a.followUpAt != null)
    .sort((a, b) => new Date(a.followUpAt).getTime() - new Date(b.followUpAt).getTime())
}

export interface WeekStats {
  appliedThisWeek: number
  rejectedThisWeek: number
  interviews: number
  offers: number
}

// Kennzahlen aus den ehrlichen Zeitstempeln: Bewerbungen und Absagen zählen
// über ihre eigenen Daten (appliedAt/rejectedAt), Gespräche und Angebote als
// Ist-Zähler der Pipeline — nichts wird aus updatedAt hergeleitet.
export function weekStats(jobs: StatsJob[], weekAgo: Date): WeekStats {
  const within = (iso: string | null | undefined) =>
    iso != null && new Date(iso).getTime() >= weekAgo.getTime()
  return {
    appliedThisWeek: jobs.filter((j) => within(j.appliedAt)).length,
    rejectedThisWeek: jobs.filter((j) => within(j.rejectedAt)).length,
    interviews: jobs.filter((j) => j.status === 'INTERVIEW').length,
    offers: jobs.filter((j) => j.status === 'OFFER').length,
  }
}
