---
target: app — gesamte App (alle Hauptseiten)
total_score: 34
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
timestamp: 2026-09-19T01-55-00Z
slug: app-gesamte-app-alle-hauptseiten
---
Method: dual-agent (A: agent-12 frischer Explore · B: agent-7 resume Detektor+Browser)

## Design Health Score (A, blind @ 8446144)

| # | Heuristik | Score | Begründung |
|---|-----------|-------|-----------|
| 1 | Systemstatus | 3 | Skeletons, Stage-Panel, „Gespeichert um"; Lücke: Detail-Statuswechsel ohne Erfolgsfeedback |
| 2 | Realwelt | 4 | durchgängig Alltagssprache, erklärte Fachbegriffe |
| 3 | Kontrolle | 3 | Undo, Abbruch-Restore, zweistufig; kein Undo nach Löschung |
| 4 | Konsistenz | 3 | 2+2 konsequent; Drift: Trichter-Zähler ohne isBacklogJob, Chips mit/ohne Border |
| 5 | Fehlervermeidung | 4 | alles Destruktive zweistufig, Dirty-Guard, Disabled-Logik |
| 6 | Erkennen | 3 | sichtbar beschriftet; Shortcuts nur als Grau-Hinweis, mobil unsichtbar |
| 7 | Flexibilität | 3 | Shortcuts, Bulk, Deep-Links; kein „Alle auswählen", nur 3 Bulk-Status |
| 8 | Ästhetik | 4 | jede Fläche verdient ihren Pixel; Toolbar dicht aber durchenkbar |
| 9 | Recovery | 4 | konkrete Diagnosen, Eingaben überleben Fehler, Resynthesize |
| 10 | Hilfe | 3 | so-funktionierts exzellent; nicht durchsuchbar |
| **Total** | | **34/40** | **Good, oberes Drittel** |

Trend: 29 → 30 → 32 → 30 → 29 → 31 → **34**. B: 0 Befunde (5. Runde in Folge), öffentliche Flächen bitgleich zu Runde 7, keine neuen deterministischen Befunde.

## Findings Runde 8 (null P1 — alles P2/P3)

- [P2] Absage-Trichter-Zähler zählt score==null über ALLE Jobs inkl. ARCHIVED/REJECTED (jobs/[id]/page.tsx:104-111) — driftet von isBacklogJob. Fix: gleicher Schnitt.
- [P2] Detail-Statuswechsel ohne Erfolgsfeedback (jobs/[id]/page.tsx:134-150) — /jobs zeigt Undo-Toast. Fix: gleicher Toast.
- [P2] Zweistufige Confirms straften Gewohnheits-Doppelklicker — /jobs-Undo-Modell als Vorzeige, Confirms nur für echt Unwiderrufliches (Job-Löschen).
- [P2] Bulk ohne „Alle auswählen", ohne „Abgelehnt" (jobs/page.tsx:651-670).
- [P3] Stärken/Lücken-Chips: Detail ohne Border vs. Suche mit (jobs/[id]/page.tsx:534 vs. search/page.tsx:1027) — zentralisieren.
- [P3] Touch-Targets der Status-Textlinks <24px (jobs/page.tsx:760-781, jobs/[id]/page.tsx:465-486) — px-2 py-1.5.
- [P3] so-funktionierts:69 „50 Treffer" hardcoded — SCORE_LIMIT interpolieren.

## Minor (Runde 8)

Fortschrittsbalken bg-primary statt selection · keyFieldFor.help 4× dupliziert · Google-Hover-Fläche ≠ Sekundär-Fläche · jobs/[id] lädt volle Liste für einen Zähler · Register ohne Wortmarke/H1-Muster von Login · „Fällig"-Badges doppeln Wiedervorlagen-Block.

## Provokante Fragen (Product — Kandidaten für Nutzer-Gespräch)

1. Launcher-Wahl vs. vorgeschlagenem Schritt? 2. Alle Destruktiven auf „ausführen + rückgängig" umstellen? 3. Eine Frage pro Karte statt 4 Statusbuttons? 4. Identität in der Copy — was bei Nicht-Muttersprachlern? 5. Ehrlichkeit als Norm — wo beweist die App Überlegenheit statt Aufrichtigkeit?

## Fix-Runde 8 + Konvergenz

Findings umgesetzt (Folge-Commit). Runde 9 als Konvergenz-Test: liefert sie nur noch P3/minor, endet die Schleife mit Abschlussbericht.
