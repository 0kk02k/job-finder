---
target: app — gesamte App (alle Hauptseiten)
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-09-18T17-20-02Z
slug: app-gesamte-app-alle-hauptseiten
---
Method: dual-agent (A: agent-2 · B: agent-1 resume)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Suchlauf-Panel exzellent; Notiz/Wiedervorlage speichert still per onBlur ohne Bestätigung |
| 2 | Match System / Real World | 3 | sachlich-warm mit Erklärungen; Lecks: „Query-Fächer" in der Erklärseite, Provider-Namen ohne Einordnung, Markdown-Editor |
| 3 | User Control and Freedom | 3 | Abbrechen mit Wiederherstellung, zweistufige Confirms; Lücke: Status-Klicks ohne Undo |
| 4 | Consistency and Standards | 3 | Zwei-Stift-Disziplin stark; Drift: „Gespräch" vs. „Interview", handgerollte Primary-Buttons, zwei identische Save-Buttons |
| 5 | Error Prevention | 3 | beforeunload-Guard, minLength; Lücke: kein Client-Valid-Feedback bei Mindestgehalt |
| 6 | Recognition Rather Than Recall | 3 | gespeicherte Suchen sichtbar, Tastatur-Hinweis sichtbar; „+ Suche speichern" nur bei newJobs > 0 |
| 7 | Flexibility and Efficiency | 3 | j/k/s/Enter, Mehrfachauswahl, Deep-Links, Rerun-Hebel — deutlich verbessert |
| 8 | Aesthetic and Minimalist Design | 3 | Kernflächen fokussiert; Lärm: Settings stapelt 7 Sektionen + doppelten Save, JobCard 4 Aktionen + 2 Disclosure-Ebenen |
| 9 | Error Recovery | 3 | Fehler nennen Ursache + Ausweg; Resume-Toasts teils vage ohne Handlung |
| 10 | Help and Documentation | 3 | /so-funktionierts entscheidungspunkt-nah verlinkt — deutlich verbessert |
| **Total** | | **30/40** | **Good (75%)** |

## Design Specificity Verdict

Hohe Spezifität, klar autorschaftlich: Ehrlichkeit ist als System gebaut (drei getrennte Fehlerzustände, null statt erfundener Scores, ungerankter Pool statt Fehlerwand), der Such-Ladezustand ist ein Produkt-Feature, destruktive Reibung ist konsequent und ruhig. Austauschbar bleiben: generische Card-Stacks, Chat-Bubbles, Login — die seltensten Flächen tragen am wenigsten Charakter.

Deterministic scan: CLI-Detektor über app/ sauber (0 Findings). Browser: /login sauber, /register 1× cramped-padding — Grenzfall/False Positive (Card hat p-6, Detektor misst inneres div isoliert). Auth-Wall unverändert: nur /login und /register erreichbar, geänderte Seiten nicht browser-inspektierbar.

## Overall Impression

Die Basis ist solider geworden: H7 und H10 stiegen um je einen Punkt, H8 um einen. Die verbliebenen Schwächen liegen in der Konsistenz der Mikrocopy, der Settings-Architektur und dem Job-Detail als gleichrangiger Daten-Stack.

## What's Working

1. Ehrlichkeit als System: getrennte Fehlerdiagnosen, null statt erfundener Scores, Absage-Trichter mit Ausweg.
2. Der Such-Ladezustand: Quellentransparenz, Zähler, Live-Karten, sr-only-Ansagen — niemand baut Ladezustände so.
3. Destruktive Reibung ruhig und lernbar: Zwei-Klick-Confirm mit Timer-Rückfall, kein Modal, immer ein Ausweg.

## Priority Issues

- [P1] Settings: zwei identische Save-Buttons („KI-Einstellungen speichern" + „Präferenzen speichern"), kein Dirty-Indikator — hasUnsavedChanges existiert intern, wird nicht in der UI gezeigt. → layout
- [P1] (beim Synthese-Lauf gefunden und sofort gefixt, Commit 05a2f58) Dashboard-„Erklärung" nannte hartkodiert „erste 15 Treffer" statt SCORE_LIMIT 50 — faktischer Widerspruch in der Ehrlichkeitsmarke.
- [P2] Job-Detail stapelt sechs gleichrangige Aufgaben; „bewerben" hat keinen Primärpfad, Anschreiben liegt zwei Scroll-Screens tief. → shape
- [P2] Terminologie-Drift: „Gespräch" vs. „Interview", „Bewertet" vs. „Bewertung", Fund/Treffer/Job. STATUS_LABELS als einzige Quelle nutzen. → clarify
- [P3] Interview-Neustart nach Abschluss ohne Confirm — derselben Akte, für die der aktive Chat Reibung einfordert. → harden

## Persona Red Flags

**Alex:** Batch-Scoring ohne Abbruch (bis 20 Läufe gefangen); keine Bulk-Aktionen in Suchergebnissen; j/k/s-Hinweis mobil unsichtbar und ohne Shortcut-Taste; Status-Wechsel ohne Undo.
**Sam:** Score-Bedeutung konsequent sr-only kompensiert (stark); Toast-Farbpunkt als einziges Typ-Signal; smooth-Scroll im Chat reißt Screenreader-Nutzer nach unten; title-only-Score im Cockpit ohne Tastatur-Äquivalent.
**Lena (projektspezifisch, PRODUCT.md):** Settings liest sich wie ein DevOps-Dashboard (Ollama/OpenRouter/Zero Data Retention, 8 Key-Felder); „Lebenslauf bearbeiten (Markdown)" ist für Nicht-Tech fremd; der 16Personalities-Block dominiert die Interview-Seite als vermeintliche Pflicht.

## Minor Observations

- saveSettings setzt setBaseline doppelt; „Neues Interview starten" vs. „Neu starten" — Bezeichnung driftet.
- „+ Suche speichern" nur bei newJobs > 0 — der Wiederkomm-Hebel fehlt im 0-Fund-Fall.
- relativeDays mit 4-stelliger Jahreszahl im Fließtext; Cockpit-Score nur per title (hover-only).
- Empty-State-Suche: zwei fast identische Erklärsätze.
- Register cramped-padding: vermutlich False Positive (unfixt, Grenzfall).

## Questions to Consider

1. Ist „Womit willst du starten?" Respekt vor der Kontrolle oder das Eingeständnis, dass die App nicht weiß, was dringend ist — was sähe ein Dashboard mit EINEM nächsten Schritt aus?
2. Warum hat jede destruktive Aktion zwei Klicks, aber jeder Statuswechsel null Undo — wo läge Toast-Undo richtig?
3. Braucht ein geschlossener Freundeskreis acht API-Key-Felder und fünf Provider — was, wenn die Builderin die KI-Konfiguration zentral pflegt?
