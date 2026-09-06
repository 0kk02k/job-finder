---
target: Suchseite /search
total_score: 18
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
timestamp: 2026-09-06T16-42-36Z
slug: app-search-page-tsx
---
# Kritik: Jobsuche (`app/search/page.tsx`)

Method: dual-agent (A: Design-Review-Subagent · B: Detector-Subagent)

## Design Health Score

| # | Heuristik | Score | Kernbefund |
|---|-----------|-------|------------|
| 1 | Sichtbarkeit des Systemstatus | 3 | Echtes Streaming mit BA-Zähler ist überdurchschnittlich — aber keine Zeiterwartung, die längste Phase (KI, 15–30 s) ist eine statische Zeile, Stufen werden nie „fertig" gezeigt, kein Abbrechen |
| 2 | Passung System/reale Welt | 2 | „Score 9/10", „High Matches (≥8)", „semantisches Matching" ist Fremdsprache für einen Pflegefreund; „Details geladen 40/100" ist API-Sprache |
| 3 | Nutzerkontrolle | 1 | Kein Abbrechen, Ignorieren ohne Undo, Fehler löscht die bisherige Ergebnisliste, AutoSave schreibt standardmäßig in die Liste |
| 4 | Konsistenz | 2 | `Button`/`ButtonLink` aus `ui.tsx` werden durch handgerollte Klassen umgangen; zwei KI-Begründungs-Varianten im identischen grünen Kasten |
| 5 | Fehlervermeidung | 2 | Zwei-Klick-Ignorier gut; AutoSave-Erklärung nur im `title`-Attribut; gespeicherte-Suchen-Chips bleiben während eines Laufs klickbar |
| 6 | Erkennen statt Erinnern | 2 | Score-Bedeutung („gut ab 8") steht in der StatCard statt am Badge; „Kein Score" wird nirgends erklärt |
| 7 | Effizienz | 2 | Deep-Link-Auto-Run via `?saved=` stark; aber kein Filter/Sortierer, Enter während des Laufs wird still geschluckt |
| 8 | Ästhetik & Minimalismus | 2 | Ruhig und token-treu, aber die JobCard schüttet alles aus (4 Chip-Gruppen + Begründung + Beschreibung); Badges stehen vor dem Titel |
| 9 | Fehlererkennung/-behebung | 1 | `role="alert"` ja, aber generisch; keine Ursache, kein Retry; tote Ergebnisliste als Folge |
| 10 | Hilfe & Dokumentation | 1 | Einzige Erklärung der Fläche ist ein `title`-Attribut; nirgends, was die KI mit dem Resume macht |
| **Total** | | **18/40** | **Poor — erheblicher UX-Überholbedarf** |

## Design-Spezifität: Urteil

Zur Hälfte authored: Placeholder, ehrliche 15-Treffer-Limit-Zeile und Zwei-Klick-Ignorier sind für dieses Produkt geschrieben. Das neue Stufen-Panel ist kategorial austauschbar („Quellen werden durchsucht …"), obwohl der Stream `platform` und Trefferzahl liefert — verlorene Transparenz, das Kernprodukt-Merkmal.

Deterministischer Scan: 0 Befunde, Exit 0, verifiziert (Kontroll-Dateien feuerten, kein Config-Waiver, keine Ignore-Kommentare). Reichweite: TSX → nur statische Regel-Teilmenge; Kontrast/Zeilenlänge/Textgröße bräuchten Browser-Evidenz. Kein Overlay verfügbar (keine Browser-Automatisierung in der Session).

## Was funktioniert

1. Der Placeholder („Pflegefachkraft, Tischlerin, Lehrerin, UX-Designer") — vier Branchen, keine Tech-Annahme, sofortige Selbst-Zuordnung.
2. Ehrlichkeit als UI-Element — 15-von-62-Limit-Zeile, „Kein Score"-Badge statt erfundener Zahl.
3. Zwei-Klick-Ignorier mit 4-s-Rückfalleitung, zustandsabhängigem aria-label, ohne Modal.

## Prioritäre Probleme

1. [P0] Fehlender Resume wird verschwiegen — ohne aktiven Resume kein ai-matching-Event, alle Karten „Kein Score", keine Limit-Zeile, Header behauptet weiter KI-Suche. Fix: Resume-Status beim Mount laden, Hinweis + Link nach /resume; Quellen-Stufe abschließen, wenn ai-matching nie kommt. → $impeccable onboard
2. [P0] 30–50 s Wartezeit ohne Zeitvertrag und ohne Exit — keine Dauerangabe, statische KI-Zeile, kein Abbrechen, Refresh verliert alles. Fix: „Dauert meist 30–60 s", verstrichene Sekunden (tabular-nums), Submit → Abbrechen via AbortController. → $impeccable polish
3. [P1] Stream nennt Quellen, UI wirft sie weg — Panel presst 8 Quellen in eine Zeile. Fix: eine Zeile pro Quelle mit Trefferzahl, BA-Zähler eingerückt. → $impeccable clarify
4. [P1] Grün umschließt jede KI-Begründung, auch bei Score 3/10 — Farbe widerspricht dem Urteil. Fix: Begründungsbox neutral, Signalfarbe nur am Badge/chips oder an scoreTone koppeln. → $impeccable colorize
5. [P1] Kein Abschlussmoment, kein Anker, Doppelsuch-Wettlauf — result-Event unmountet lautlos, Fokus bleibt am Submit, Chips klickbar während des Laufs. Fix: Abschluss ansagen („62 Treffer, 8 Top Matches"), Chips deaktivieren, erste Karte anspringen. → $impeccable animate

## Persona-Rote-Flaggen

- Alex (Power-User): kein Abbrechen/Retry, Enter tot während des Laufs, keine Sortierung/Filterung, Suche bei newJobs=0 nicht speicherbar.
- Jordan (Nicht-Tech, evtl. ohne Resume): „Kein Score"-Wand ohne Erklärung, Jargon („semantisches Matching", Score-Skala), AutoSave-Erklärung title-only.
- Sam (Screenreader): aria-live-Region mit BA-Zähler → Dutzende Ankündigungen + redundantes role="status"; Ergebnisliste ohne Überschrift/List-Semantik; Ignorieren verschiebt Fokus ohne Ankündigung, kein Undo.
- Riley (Stress): Chip-Klick während Lauf → konkurrierende Suche in denselben State; Refresh = Totalverlust; Fehler löscht Ergebnisliste; key={job.url}-Kollision bei Portal-Dubletten.
- Casey (mobil): Layout-Shift durch Button-Label-Wechsel im Verpflichtungsmoment; 3 Buttons pro Karte umbrechen in zwei Zeilen; 4-s-Fenster beim Daumen-Scrollen kaum treffbar.
- Freundin in anderer Branche: Placeholder trifft sie; ihre Treffer landen überwiegend hinter der 15er-Grenze → „Kein Score"-Wand; „Details geladen 40/100" ist nicht ihre Sprache.

## Kleinigkeiten

- Dark Mode: „In deiner Liste"/„Ignorieren" verlieren Fill-Kontrast auf bg-surface.
- Primär-Button in der Spalte des Ort-Felds — CTA gehört zum falschen Feld.
- Kein <h2> auf der Seite; „Gespeicherte Suchen" ist ein gestyltes <p>.
- Badge-Reihenfolge Quelle vor Score widerspricht „Quelle ist Material, nicht Bedeutung".
- Kein Toast nach Ignorieren; setTimeout im Ignorier-Handler wird bei Unmount nicht geräumt.
- „Keine Jobs gefunden" ohne konkreten nächsten Schritt.
- Geprüft und verworfen: „total vs. results.length können auseinanderliegen" (können sie aktuell nicht); „semantic: false hartkodiert" (Route setzt korrekt pro Pfad, Seite liest es nur nie).

## Provokante Fragen

1. Warum funktioniert /search ohne Lebenslauf einfach weiter, und schlechter — statt eine eigene Fläche zu sein?
2. Für wen ist das Stufen-Panel geschrieben — Nutzerin oder Entwicklerin?
3. Ist eine 85-%-„Kein Score"-Liste ehrlich — oder ein Systemlimit im Ehrlichkeits-Kostüm?
