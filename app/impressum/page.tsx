import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Impressum — Job-Finder',
  description: 'Anbieterkennzeichnung der privaten Job-Finder-Instanz.',
}

// Angaben wie auf cookingcompiler.com (gleiche Betreiberin) — Stand 10.09.2026
export default function ImpressumPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-light text-foreground mb-8">Impressum</h1>
      <div className="space-y-8 text-primary leading-relaxed">
        <section>
          <h2 className="text-sm font-medium text-foreground mb-2">Angaben gemäß § 5 DDG</h2>
          <p>Verantwortlich für den Inhalt:</p>
          <p>
            Okko Prothmann
            <br />
            Boddinstr 14
            <br />
            12053 Berlin
            <br />
            Deutschland
          </p>
        </section>
        <section>
          <h2 className="text-sm font-medium text-foreground mb-2">Kontakt</h2>
          <p>
            E-Mail:{' '}
            <a
              href="mailto:okko.prothmann@gmail.com"
              className="underline decoration-selection/60 underline-offset-4 hover:text-foreground hover:decoration-selection"
            >
              okko.prothmann@gmail.com
            </a>
          </p>
        </section>
        <section>
          <h2 className="text-sm font-medium text-foreground mb-2">Charakter der Instanz</h2>
          <p>
            Job-Finder ist eine private, nicht-kommerzielle Instanz für einen festen
            Freundeskreis. Es gibt keine Registrierung für Unbeteiligte, keine Werbung und
            keine Datenweitergabe.
          </p>
        </section>
      </div>
    </main>
  )
}
