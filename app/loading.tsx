// Route-Root-Skeleton: fängt die Zeit zwischen Navigation und Client-Hydration ab.
// Die Dashboard-Seite hat ihr eigenes feineres Skeleton (inkl. Screenreader-Ansage) —
// dieses hier trägt nur die grobe Seitenform, damit kein Framework-Blank entsteht.
export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-5xl mx-auto px-6 py-16">
        <p className="sr-only" role="status">
          Seite wird geladen …
        </p>
        <div className="animate-pulse motion-reduce:animate-none" aria-hidden="true">
          <div className="bg-accent-soft/30 rounded-2xl p-8 border border-accent/20 mb-6">
            <div className="h-9 w-2/3 bg-border rounded mb-4" />
            <div className="h-4 w-1/2 bg-border rounded mb-6" />
            <div className="h-12 w-44 bg-border rounded-xl" />
          </div>
          <div className="h-8 w-56 bg-border rounded mb-6" />
          <div className="space-y-4">
            <div className="h-24 bg-surface border border-border-soft rounded-2xl" />
            <div className="h-24 bg-surface border border-border-soft rounded-2xl" />
            <div className="h-24 bg-surface border border-border-soft rounded-2xl" />
          </div>
        </div>
      </main>
    </div>
  )
}
