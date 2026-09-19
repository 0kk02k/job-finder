---
target: app — gesamte App (alle Hauptseiten)
total_score: 36
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
p2_count: 2
timestamp: 2026-09-19T03-15-00Z
slug: app-gesamte-app-alle-hauptseiten
---
Method: dual-agent (A: agent-14 frischer Explore · B: agent-7 resume Detektor+Browser)

## Design Health Score (A, blind @ 23f8555)

| # | Heuristik | Score | Kernpunkt |
|---|-----------|-------|-----------|
| 1 | Systemstatus | 4 | Staged-Panel, Uhrzeit pro Feld, Pending je Format, sr-only |
| 2 | Realwelt | 4 | durchgängig deutsch, Fachbegriffe inline erklärt |
| 3 | Kontrolle | 4 | Undo-Vertrag bis in die API, zweistufig, Abbruch-Restore |
| 4 | Konsistenz | 3 | Ocker-Tints als Zustand (Bubbles/Gewichtungs-Chips) — gedämpft, driftfähig |
| 5 | Fehlervermeidung | 4 | Doppelklick-Guards, beforeunload, Constraints |
| 6 | Erkennen | 3 | Deep-Links, S/J/K-Hinweis; Shortcuts nur auf /jobs |
| 7 | Flexibilität | 3 | S/J/K/Enter, Bulk, Deep-Links; kein Global-Layer |
| 8 | Ästhetik | 3 | Hierarchie diszipliniert; Karten/Settings dicht |
| 9 | Recovery | 4 | getrennte Diagnosen, Text bleibt im Feld, Resynthesize |
| 10 | Hilfe | 3 | Erklärseite ehrlich + kontextuell; kein kontextuelles Erstnutzungs-Help |
| **Total** | | **36/40** | **Excellent (obere Kante, ehrlich verteilt)** |

Trend: 29 → 30 → 32 → 30 → 29 → 31 → 34 → 35 → **36**. B: 0 Befunde (7. Runde), alle Runde-9-Fixes verifiziert, öffentliche Flächen vier Runden bitgleich.

## Findings Runde 10

**[P1] Settings-Dirty-Flag dauerhaft aktiv für Profil-Nutzer** (settings/page.tsx:215-229): `dirty` prüft Profil-Felder gegen `''`, wird aber mit Server-Stand befüllt → Banner „Ungespeicherte Änderungen" endlos, beforeunload klemmt jede Navigation, der Speichern-Button löst es nie (Profil-Felder nicht in Settings-Payload). Einzige Stelle, wo die App strukturell täuscht. Fix: echte Differenz gegen geladenen Baseline-Stand.
**[P2] Batch-Abbruch nur im unscored-Zweig** (jobs/page.tsx:589-623): im anderen Zweig fehlt „Stoppen".
**[P2] Resume-Fetch-Fehler → falscher Upload-Modus** (resume/page.tsx:90-105): catch loggt nur, UI behauptet „kein Lebenslauf". Fix: Fehler-State mit Retry.

## Minor (Runde 10)

Filter/Sort nicht in URL zurückgeschrieben · optimistische Bubble bleibt bei Sendefehler stehen (Doppelanzeige) · Ocker-Tints als Zustand · Google-Logo gehört als Ausnahme in DESIGN.md · Launcher + Onboarding zeigen bei fehlendem Resume dieselbe Botschaft doppelt · Footer „Einstellungen" landet für anonyme im Redirect · Interview-Akte mischt /5-Chips in /10-Vokabular.

## Provokante Fragen (Product — Kandidaten für Nutzer-Gespräch)

1. Rückstand als Bußzettel-Zahl — oder als Angebot? 2. Score als kleinster Akteur auf der Karte — verdient der Anker den Platz? 3. Zwei Chats, 80 % dasselbe UI — gemeinsamer Frame wartend? 4. Register-Screen für 5-Personen-Einladungskreis — Relikt?

## Fix-Runde 10

P1 + 2× P2 umgesetzt (Folge-Commit). Runde 11 = nächster Konvergenz-Test.
