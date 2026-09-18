---
target: app — gesamte App (alle Hauptseiten)
total_score: 32
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-09-18T21-20-36Z
slug: app-gesamte-app-alle-hauptseiten
---
Method: dual-agent (A: agent-6 frischer Explore · B: agent-7 Detektor+Browser)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Stufen-Panel/Skeletons/sr-only stark; Blur-Autospeichern (Notiz/Wiedervorlage) ohne „Gespeichert"-Impuls |
| 2 | Match System / Real World | 4 | durchgängig deutsche Alltagssprache, API-Keys erklärt, relative Daten |
| 3 | User Control and Freedom | 3 | Abbruch mit Snapshot, zweistufige Deletes; Lücken: kein Undo bei Status-Wechsel, Bulk ohne Rückfrage |
| 4 | Consistency and Standards | 3 | Zwei-Stifte-Disziplin; Drift: Zähler „unbewertet" unterschiedlich auf Dashboard vs. /jobs, handgerollte Buttons auf /resume, StatusButton dupliziert StatusBadge |
| 5 | Error Prevention | 3 | zweistufige Confirms, beforeunload; Lücke: „Abgelehnt" ein Klick, sofort persistiert, kein Undo |
| 6 | Recognition Rather Than Recall | 3 | Suchen-Chips, Tastatur-Hinweis; Kürzel nur in text-xs-Zeile, Settings nur im Footer |
| 7 | Flexibility and Efficiency | 3 | S/J/K + Enter, Mehrfachauswahl, Batch mit Abbruch, Deep-Links |
| 8 | Aesthetic and Minimalist Design | 3 | Suchergebnisliste: je Karte ein Ocker-„Ansehen"-Button (15 Ocker-Flächen statt „ein Ocker pro Viewport"); Job-Karten mit 4 StatusButtons + Link + Checkbox gleichgewichtig; 16P-Karte ohne Lebenszyklus |
| 9 | Error Recovery | 4 | Fehlerdiagnosen präzise getrennt, Eingaben zurückgeholt, Resynthesize; Kleinigkeit: /jobs Fetch-Fehler → still „0 Jobs" |
| 10 | Help and Documentation | 3 | /so-funktionierts exzellent und entscheidungspunkt-nah; nicht durchsuchbar, kein Anker beim „Warum?"-Link des Bewertungs-Limits |
| **Total** | | **32/40** | **Good (80%)** |

## Design Specificity Verdict

Klar produktgegründet, nicht austauschbar: Zwei-Stifte-Regel zieht durchgehend Entscheidungen (ui.tsx:15, nav.tsx:43), inhaltliche Verankerung (Absage-Trichter mit „Kopf hoch", ehrliche Score-Limits, Anekdoten-Chooser mit „Mutmaßung, nicht Gewissheit", Query-Fächer als Transparenz-Panel). Login/Register nahe an Standard-Auth — vertretbar (Footer-Grundsatz „Rechtsseiten kennen keine Anmeldung").

## Cognitive Load

3 Verstöße (moderate): Suchergebnis-Karte 6+ Layer; Job-Listen-Karte ohne eindeutigen „einen Schritt"; zwei „unbewertet"-Zahlen mit unterschiedlicher Semantik (page.tsx:148-150 vs. jobs/page.tsx:152).

Entscheidungspunkte >4 Optionen: Job-Karte (6 Interaktionen × N Karten), Filter-Toolbar (~11 Kontrollen, durch Grouping entschärft), /interview-Einstieg (3 parallele Angebote), /resume-Anekdoten (Formularwand bei mehreren Vorschlägen).

## Emotionale Reise

Peaks: Live-Suchstrom (Karten wachsen unter Stufen-Panel), „{n} neu"-Badges, Absage-Trichter (emotional intelligentester Code). Enden: Dashboard bei gespeicherten Suchen, Akte mit PDF. Täler: „0 Bewerbungen" nüchtern-kalt. Nicht gehaltene Versprechen: Onboarding-Schritt 4 führt zu Schritt 3 (beide → /search); 16P-Block steht permanent (auch im Chat/nach Abschluss); „Warum?"-Link landet im Fließtext statt am Limit-Anker.

## Priority Issues

**[P1] Job-Karte: sechs gleichgewichtige Handlungen, Fehlklick ohne Wiedergutmachung** (jobs/page.tsx:609-644)
4 StatusButtons + externer Link + Checkbox, „Abgelehnt"/„Archiv" ohne Bestätigung/Undo; Zähler-Semantik weicht zwischen Dashboard und /jobs ab. Fix: Rückgängig-Toast für Status-Wechsel + Zähler vereinheitlichen (eine Definition von „Rückstand").

**[P1] Suchergebnisliste: 15 Ocher-CTAs pro Bildschirm** (search/page.tsx:950-957)
Jede Treffer-Karte trägt einen Ocker-„Ansehen"-Button — bricht „ein Ocker pro Viewport" (DESIGN.md:199). Fix: „Ansehen" zum dezenten Textlink, „Zu meiner Liste" als einzige Button-Fläche pro Karte.

**[P2] Onboarding-Schritt 4 führt zu Schritt 3** (page.tsx:308-323)
Beide linken auf /search mit nahezu identischem CTA. Fix: zu drei ehrlichen Schritten zusammenführen, oder Schritt 4 automatisch erledigt nach erster bewerteter Suche.

**[P2] 16Personalities-Block ohne Lebenszyklus** (interview/page.tsx:367-411)
Rendert bedingungslos — auch mitten im Chat und nach Abschluss über der Akte. Fix: Zustands-Gate (nur vor Start, nach Start/Abschluss ausblenden).

**[P2] Autospeichern ohne sichtbaren Abschluss** (jobs/[id]/page.tsx:817-825, applications/page.tsx:134-142)
Notiz/Wiedervorlage speichern per Blur ohne „Gespeichert"-Signal. Fix: diskretes „Gespeichert um HH:MM" am Feld nach erfolgreichem Patch.

## Deterministische Befunde (Assessment B)

1. **proxy.ts leitet /so-funktionierts, /impressum, /datenschutz auf /login um** (proxy.ts:12) — Matcher schließt sie nicht aus; Browser-Evidenz finalUrl=/login für alle drei. Widerspricht Footer-Grundsatz „Rechtsseiten kennen keine Anmeldung".
2. Footer komplett below-the-fold auf Login/Register (top=vh) — Impressum/Datenschutz erst nach Scroll.
3. Login/Register-Inputs ohne programmatisch verknüpfte Labels (Accessibility-Name leer; Verdacht: label ohne htmlFor).
4. Detektor: 0 Befunde (clean). Kein Overflow/Layout-Bruch, sichtbarer Ocker-Fokus, logische Tab-Order auf beiden Auth-Seiten (Desktop+Mobil, 13 Screenshots in shots-runde4/).

## Persona-Red-Flags

- **Alex**: Fehlklick „Abgelehnt" ohne Undo; zwei „unbewertet"-Zahlen; „Treffer automatisch übernehmen" nur per title-Tooltip erklärt; Kürzel-Hinweis in text-xs.
- **Sam**: klickt Status der Reihe nach durch (jeder Klick persistiert); experimenteller Portal-Sync mit vollwertigem Ocher-CTA + Passwort; „Neues Interview" löscht Akte; vier gleichgewichtige Header-Buttons auf /resume.

## Minor Observations

- jobs/page.tsx:104-106 Fetch-Fehler nur console.error → still „0 Jobs" (einzige Seite ohne Error-State)
- Batch-Schleife hart auf 20 Läufe, bricht bei >400 unbewerteten still ab
- login/page.tsx:32-35 Fehler ohne role="alert" (Register hat es)
- register/page.tsx:56 Catch-All „Ein Fehler ist aufgetreten" untypisch generisch
- resume/page.tsx:355 Placeholder „..." statt „…"
- preferences/page.tsx:355 line-through auf erledigten Themen (SR-Verwirrung)
- applications/page.tsx:277-288 Empty-State CTA → /jobs?filter=high_match kann ins „Keine Jobs"-Tal führen
- Toasts ohne Fokus-Einstieg; window.location.search statt useSearchParams
- „+ Suche speichern" als Textlink statt Ocker-Aktion am Lauf-Ende (Product-Frage 3)

## Provokante Fragen (unbeantwortet, Product-Ebene)

1. Hat eine 5-Personen-App 4 Status-Schnellbuttons pro Karte verdient — oder eine Entscheidung pro Karte?
2. Wo führt die App den Beweis „messbar besser als die Portale" sichtbar?
3. Warum ist „Suche speichern" nach einem Lauf nur ein Textlink?
4. Soll der Absage-Ausweg auch auf /jobs existieren, wo der Moment am häufigsten passiert?
5. Ist der experimentelle Portal-Sync mit Ocher-Primary + Passwort ein Rückbau-Kandidat?

## Fix-Runde 4 (umgesetzt in Commit nach diesem Snapshot)

Siehe Commit-Message; Umfang: beide P1 (Undo-Toast + Zähler-Vereinheitlichung, Ocker-Entschärfung Suchliste), P2 16P-Gate + Autospeichern-Signal, proxy.ts öffentliche Seiten, Labels/role=alert/Error-State-Kleinigkeiten.
