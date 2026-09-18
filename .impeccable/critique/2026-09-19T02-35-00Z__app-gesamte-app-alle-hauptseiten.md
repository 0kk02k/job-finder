---
target: app — gesamte App (alle Hauptseiten)
total_score: 35
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
p2_count: 1
timestamp: 2026-09-19T02-35-00Z
slug: app-gesamte-app-alle-hauptseiten
---
Method: dual-agent (A: agent-13 frischer Explore · B: agent-7 resume Detektor+Browser)

## Design Health Score (A, blind @ 19a6886)

| # | Heuristik | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Systemstatus | 4 | Stufen-Panel, Skeletons, sr-only, „Gespeichert um" |
| 2 | Realwelt | 4 | durchgängig Alltagssprache |
| 3 | Kontrolle | 4 | Undo-Toast auf JEDEN Statuswechsel, Abbruch-Restore, zweistufig |
| 4 | Konsistenz | 3 | handkopierte Button-Strings an ~6 Stellen (Drift-Risiko) |
| 5 | Fehlervermeidung | 4 | Dirty-Guard, Doppelklick-Schutz, required |
| 6 | Erkennen | 3 | Tastatur-Hint gedruckt; J/K nur auf /jobs |
| 7 | Flexibilität | 3 | Shortcuts, Bulk mit Select-all, Deep-Links |
| 8 | Ästhetik | 3 | Job-Karte 5+ Kontrollen — Chrome-lastig bei 188 Jobs |
| 9 | Recovery | 4 | getrennte Diagnosen, Eingabe-Rückholung, Resynthesize |
| 10 | Hilfe | 3 | Erklärseite + „Warum?"-Links; kein kontextuelles Onboarding-Help |
| **Total** | | **35/40** | **Good, Band-Obergrenze** |

Trend: 29 → 30 → 32 → 30 → 29 → 31 → 34 → **35**. B: 0 Befunde (6. Runde), alle Runde-8-Fixes verifiziert, öffentliche Flächen drei Runden bitgleich.

## Findings Runde 9

- **[P2] Einzeiliges Eingabefeld im Interview-Chat** (interview/page.tsx:561-568, preferences:398-405) — 15–20-minütiges Gespräch mit erzählerischen Antworten braucht textarea (Enter=Umbruch, Strg+Enter=Senden, autogrow).
- [P3] Brief PDF/DOCX teilt sich Ladezustand (jobs/[id]/page.tsx:813-818).
- [P3] Launcher-Anker #gespeicherte-suchen zeigt ins Leere wenn Onboarding sichtbar (page.tsx:285 vs. 593).
- [P3] J/K-Highlight ohne Fokus/ARIA (jobs/page.tsx:310-325).
- [P3] max-w-3xl auf /resume bricht 1024px-Regel (vermutlich bewusst, undokumentiert).

## Minor (Runde 9)

Metadata-Titel „Job Finder" vs. „Job-Finder" · so-funktionierts: Abschnitt 6 ohne Nummer · Google-SVG dupliziert · Interview/Preferences ~200 Zeilen Chat-Duplikat · „Die Beraterin schreibt …" — gute Persona-Stimme.

## Provokante Fragen (Product — Kandidaten für Nutzer-Gespräch)

1. Erfolgsmomente zu leise — was wäre ein North-Star-Peak? 2. Launcher-Frage täglich: Bescheidenheit oder fehlende Führung? 3. Freier Chat für Nicht-Techies — oder strukturierte Schritt-Formulare mit Chat-Feeling? 4. Bei welcher Listengröße kippt die Job-Karte?

## Fix-Runde 9 + Konvergenz

P2 + P3 umgesetzt (Folge-Commit). Runde 10: liefert sie null P1/P2, endet die Schleife per Kriterium mit Abschlussbericht.
