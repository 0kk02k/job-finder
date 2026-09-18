import type { Metadata } from 'next'
import Link from 'next/link'
import { SCORE_LIMIT } from '@/lib/search'

export const metadata: Metadata = {
  title: 'So funktioniert’s — Job-Finder',
  description:
    'Wie die Suche findet, was sie findet: Quellen, Query-Fächer, KI-Ranking jenseits von Labels, Score-Bedeutung und ehrliche Grenzen.',
}

export default function SoFunktioniertsPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-light text-foreground mb-3">So funktioniert’s</h1>
      <p className="text-primary-soft mb-8">
        Der Weg eines Treffers — von den Portalen in deine Liste. Ehrlich inklusive
        der Grenzen, die der Score nicht zeigt.
      </p>
      <div className="space-y-8 text-primary leading-relaxed">
        <section>
          <h2 className="text-sm font-medium text-foreground mb-2">1 · Alles beginnt mit deinem Lebenslauf</h2>
          <p>
            Auf der <Link href="/resume" className="text-selection hover:text-foreground">Lebenslauf-Seite</Link> lädst du
            deinen CV als PDF, DOCX oder Text hoch — der Text wird daraus entnommen und ist die
            einzige Kompetenzbeschreibung, gegen die bewertet wird. Kein Lebenslauf, keine
            Bewertung: Die Suche findet dann zwar Treffer, aber ohne Scores.
          </p>
        </section>
        <section>
          <h2 className="text-sm font-medium text-foreground mb-2">2 · Breite Suche über viele Quellen</h2>
          <p>
            Ein Suchbegriff trifft neunmal auf dem gleichen Stapel auf. Deshalb fragt die Suche
            gleichzeitig mehrere Quellen ab — Jooble, Remotive, Arbeitnow, die Arbeitsagentur
            und Adzuna, optional LinkedIn über einen Apify-Zugang — und mischt die Treffer zu
            einem Kandidatenpool. Danach erzeugt die KI aus deinem Lebenslauf 5–10 alternative
            Suchbegriffe (Query-Fächer): Fähigkeiten und Schwerpunkte statt des eingegebenen
            Titels. Bis zu drei davon laufen sofort parallel mit — Treffer unter fremden
            Schlagworten kommen so in den Pool, ohne dass die Suche länger dauert.
          </p>
        </section>
        <section>
          <h2 className="text-sm font-medium text-foreground mb-2">3 · Ranking jenseits von Labels</h2>
          <p>
            Die Kernidee: Titel lügen, Fähigkeiten stehen tief in der Anzeige. Ein schnelles
            KI-Modell liest jede Anzeige bis in die Beschreibung und vergleicht sie mit deinem
            Lebenslauf — Fachinformatiker für Daten- und Prozessanalyse werden so auch
            „Entwickler:in für KI-Workflows &amp; Prozessautomatisierung“ oder „AI Infrastructure
            Engineer“, obwohl keiner deinen Berufsstempel trägt. Dazu kommt, was du abseits des
            CV wirklich willst: Das{' '}
            <Link href="/preferences" className="text-selection hover:text-foreground">Präferenz-Gespräch</Link> wird
            zu einem Profil mit Gewichtungen — Remote-Freiheit, Team, Gehalt — und
            „Meidet“-Punkte senken den Score wie ein zu niedriges Gehalt.
          </p>
        </section>
        <section>
          <h2 className="text-sm font-medium text-foreground mb-2">4 · Was der Score bedeutet</h2>
          <p>
            Die semantische Relevanz (0–1) wird auf dieselbe Skala gebracht wie der klassische
            KI-Score: 1–10. <span className="text-foreground">8+ ist ein High Match</span> — die
            Trefferkarte landet oben. 6–7 heißt guter Fit mit Lücken. 5 oder weniger ein großer
            Gap. Gespeichert wird, was ab 0,7 Relevanz liegt — deshalb beginnen die Scores der
            Liste faktisch bei 7: Die Auslese passiert im Ranking, bevor ein Treffer
            überhaupt in deine Liste kommt. Der Score ist ein Anker für die Sortierung, keine
            Instanz: Er begründet sich, die Entscheidung triffst du.
          </p>
        </section>
        <section id="score-limit" className="scroll-mt-24">
          <h2 className="text-sm font-medium text-foreground mb-2">5 · Ehrliche Grenzen</h2>
          <p>
            Die klassische Suche bewertet bis zu {SCORE_LIMIT} Treffer pro Lauf (einer kostet nur einen
            Bruchteil eines Cents) — Reste zieht ein nächtlicher Lauf nach, und auf jeder
            Job-Detailseite steht „Jetzt bewerten“ für den Einzelnen. Fällt die KI ganz aus,
            siehst du den Pool ungerankt statt einer Fehlerwand — nichts wird gespeichert, die
            Übernahme bleibt dir vorbehalten. Und zwei Dinge prüft die KI nicht: formale
            Voraussetzungen (eine Werkstudenten-Stelle kann Score 9 bekommen, obwohl du längst
            ausgelernt bist) und die Realität hinter der Anzeige. Beworben wird nie automatisch.
          </p>
        </section>
        <section>
          <h2 className="text-sm font-medium text-foreground mb-2">6 · Danach: dein Fahrplan</h2>
          <p>
            „Zu meiner Liste“ übernimmt einen Treffer, der Wechsel in den Pipeline-Status
            (Beworben, Absage, Interview) passiert auf der{' '}
            <Link href="/jobs" className="text-selection hover:text-foreground">Jobs-Seite</Link> oder im Detail.
            Dort entsteht auch das Anschreiben — aus Anzeige, Lebenslauf und deinen Anekdoten —
            und die Lebenslauf-Downloads in der Sprache der Anzeige. Das{' '}
            <Link href="/interview" className="text-selection hover:text-foreground">Interview</Link> trainiert
            dich mit deinem echten Material, die{' '}
            <Link href="/applications" className="text-selection hover:text-foreground">Bewerbungs-Seite</Link> hält
            Fristen und Widerworte fest.
          </p>
        </section>
        <section>
          <h2 className="text-sm font-medium text-foreground mb-2">Wo die KI herkommt</h2>
          <p>
            Der KI-Provider steht in den{' '}
            <Link href="/settings" className="text-selection hover:text-foreground">Einstellungen</Link> — mit deinem
            eigenen Schlüssel, der verschlüsselt gespeichert wird. Anzeigen-, Lebenslauf- und
            Gesprächstexte gehen an genau diesen Provider — ohne Speicherung der Inhalte, ohne
            Trainingsnutzung; Details stehen im{' '}
            <Link href="/datenschutz" className="text-selection hover:text-foreground">Datenschutz</Link>.
          </p>
        </section>
      </div>
    </main>
  )
}
