---
target: app — gesamte App (alle Hauptseiten)
total_score: 31
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
timestamp: 2026-09-19T01-05-00Z
slug: app-gesamte-app-alle-hauptseiten
---
Method: dual-agent (A: agent-11 frischer Explore · B: agent-7 resume Detektor+Browser)

## Design Health Score (A, blind @ 9ebbd59)

| # | Heuristik | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Sichtbarkeit Systemstatus | 4 | Stream-Panel, Pending-Labels, aria-busy, sr-only, „Gespeichert um" — beinahe lückenlos |
| 2 | System ↔ Realität | 3 | Alltagssprache; eigenes Vokabular („Rückstand", „Funde") ist erklärt |
| 3 | Kontrolle & Freiheit | 3 | Undo 12 s, Abbruch-Restore, zweistufig; Lücke: kein Undo bei Ignorieren/Löschen/Erstellen |
| 4 | Konsistenz | 3 | Detailseite 4 gleichgewichtige Statusbuttons vs. /jobs 2+2; aktiver REJECTED blau statt Ton |
| 5 | Fehlerprävention | 3 | Lücke: „Ersetzen" ohne Bestätigung |
| 6 | Erkennen statt Erinnern | 3 | Gewichtungs-Notizen nur per Hover (eigene Regel verletzt) |
| 7 | Flexibilität | 3 | Shortcuts, Bulk, Deep-Links |
| 8 | Ästhetik/Minimalismus | 3 | Job-Karte 8 Affordanzen (gewichtet, bleibt dichtester Punkt) |
| 9 | Fehlererkennung & Recovery | 3 | Lücke: stille Speicher-Fehler im Resume (!response.ok unbehandelt) |
| 10 | Hilfe & Doku | 3 | Ehrlich + kontextuell; nicht durchsuchbar |
| **Total** | | **31/40** | **Good** |

Trend: 29 → 30 → 32 → 30 → 29 → 31. **Erste Runde ohne P1.** B: Detektor 0 (4. Runde in Folge), alle Runde-6-Fixes verifiziert (Footer top=797 < vh 900 auf /login + /register, Proxy-Redirect eingeloggter Nutzer 307 → /, kein Overflow auf 10 Viewport-Kombis), keine neuen deterministischen Befunde.

## Findings Runde 7 (alle P2/P3 — kein P1)

- [P2] Stille Speicher-Fehler im Resume (resume/page.tsx:185-229) — !response.ok ohne Toast.
- [P2] Status-Gewichtung Detail ≠ Liste (jobs/[id]/page.tsx:452-461) — 2+2-Muster + Ton für aktives REJECTED übernehmen.
- [P2] „Ersetzen" ohne Rückfrage (resume/page.tsx:301).
- [P2] Gewichtungs-Notizen nur per Hover (preferences/page.tsx:469, settings/page.tsx:787) — eigene Regel (search/page.tsx:551) verletzt.
- [P3] „Weiter im Onboarding"-Label ohne Onboarding-Kontext (interview/page.tsx:579, preferences/page.tsx:503).
- [Doc-Drift] so-funktionierts (50/Lauf + nächtlicher Lauf — stimmt, SCORE_LIMIT=50, Cron existiert) vs. PRODUCT.md („15 Jobs pro Suche") — PRODUCT.md aktualisieren.

## Minor (Runde 7)

ScoreChip im Interview rendert eigene „x/5"-Syntax statt ScoreBadge · „Absagen diese Woche" ohne Trichter-Kontext · Score-Pill-in-Plattform-Pill doppelt gerahmt · drei unterschiedliche Sicherheitszeitfenster (12s/8s/4s) ohne System · Public-Nav exakter Pfad-Match (Trailing-Slash-Kantenfall) · Google-Brandfarben als einziger Farbriss (vertretbar) · Launcher nicht dismissbar · Anschreiben nur Client-State (Refresh = Verlust, bewusst).

## Provokante Fragen (Product, unbeantwortet — Kandidaten für Nutzer-Gespräch)

1. Score ohne visuelle Skala — ehrlicher oder nur lauter? 2. Launcher-Frage selbst als Last — ein dominanter „Nächster Schritt" statt? 3. Anschreiben-Client-State: bewusste Kontrolle oder teuerster Verlust? 4. Doc-Drift als Produkt-Wahrheitsfrage. 5. Status-Wechsler dreimal mit drei Gewichtungen — auf dem Detail nur ein „Status ändern"-Eingriff?

## Fix-Runde 7

5 Findings + Doc-Drift umgesetzt (Folge-Commit). Danach Runde 8; wenn die erneut null P1 liefert, ist die Schleife konvergiert.
