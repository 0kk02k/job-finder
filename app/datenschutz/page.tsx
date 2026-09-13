import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Datenschutz — Job-Finder',
  description:
    'Welche Daten die private Job-Finder-Instanz speichert, welche Dienste beteiligt sind und was nicht passiert.',
}

export default function DatenschutzPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-light text-foreground mb-3">Datenschutz</h1>
      <p className="text-primary-soft mb-8">
        Kurz und ehrlich: was diese Instanz speichert, wer beteiligt ist — und was
        ausdrücklich nicht passiert.
      </p>
      <div className="space-y-8 text-primary leading-relaxed">
        <section>
          <h2 className="text-sm font-medium text-foreground mb-2">Was gespeichert wird</h2>
          <p>
            Dein Konto (Name, E-Mail, Passwort — gespeichert nur als bcrypt-Hash), deine
            Lebensläufe, gefundene Jobs inklusive KI-Bewertungen, Bewerbungs-Notizen und
            deine Einstellungen. Zugangsdaten für KI-Provider werden verschlüsselt
            abgelegt. Alles gehört dir: Archivieren und Löschen entfernt Daten
            endgültig, ein Löschen einer Stelle nimmt ihre Historie mit.
          </p>
        </section>
        <section>
          <h2 className="text-sm font-medium text-foreground mb-2">Beteiligte Dienste</h2>
          <p>
            Hosting läuft auf Vercel, die Datenbank auf Neon (Postgres, Standort EU).
            Für die KI-Bewertung überträgt die Instanz pro Suchlauf, Einzelbewertung
            oder Gespräch den Text der Stellenanzeige, deinen Lebenslauf-Text und
            deine Gesprächsverläufe an den KI-Provider,
            den du selbst in den Einstellungen hinterlegt hast — zu keinem anderen
            Zweck und an niemand sonst. Für das Anekdoten-Mini-Interview und die
            Anschreiben-Erzeugung kommen zusätzlich deine Anekdoten-Texte an
            denselben Provider — ebenfalls nur zu diesem Zweck. Der Provider
            verarbeitet diese Anfragen global und ohne feste Region — gespeichert
            werden sie nicht: Zero Data Retention ist aktiviert, es gibt keine
            zurückbehaltene Kopie und keine Trainingsnutzung der Inhalte.
            Stellensuche fragt öffentliche Quellen ab (Jooble, Remotive, Arbeitnow,
            optional LinkedIn via Apify).
          </p>
        </section>
        <section>
          <h2 className="text-sm font-medium text-foreground mb-2">Was nicht passiert</h2>
          <p>
            Kein Tracking, keine Analyse-Tools, keine Werbe-Cookies — der einzige
            Cookie ist deine eigene Anmeldung. Kein Verkauf von Daten, keine
            automatischen Bewerbungen: Bewerbungen verschickst immer du selbst. Was
            dagegen bewusst die App verlässt, steht oben: Lebenslauf-, Anzeigen- und
            Gesprächstexte gehen zur KI-Verarbeitung an den Provider deiner Wahl —
            ohne Speicherung dort (Zero Data Retention).
          </p>
        </section>
      </div>
    </main>
  )
}
