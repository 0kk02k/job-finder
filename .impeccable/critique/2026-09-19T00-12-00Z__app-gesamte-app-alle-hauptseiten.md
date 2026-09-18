---
target: app — gesamte App (alle Hauptseiten)
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-09-19T00-12-00Z
slug: app-gesamte-app-alle-hauptseiten
---
Method: dual-agent (A: agent-10 frischer Explore · B: agent-7 resume Detektor+Browser)

## Design Health Score (A, blind @ 00a1d8b)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Stream-Panel, „Gespeichert um", Batch-Zähler; stille Hintergrund-Fetches, „Aktualisieren" ohne Pending |
| 2 | Match System / Real World | 3 | Alltagssprache, Berufs-Placeholders; Lecks: „Query-Fächer", „Adzuna App-ID" |
| 3 | User Control and Freedom | 3 | Undo 7 s, Abbruch-Restore, zweistufig; kein Undo für Löschen/Ignorieren |
| 4 | Consistency and Standards | 2 | ScoreBadge auf Detail inline nachgebaut (text-5xl über Token), Button-Class-Kopien an ≥6 Stellen, „Archiv" vs. „Archiviert" |
| 5 | Error Prevention | 3 | Dirty-Guards, zweistufig; Bulk-PATCH prüft Einzelantworten nicht |
| 6 | Recognition Rather than Recall | 3 | sichtbare Chips/Hinweise; Shortcut-Hinweis mobil unsichtbar |
| 7 | Flexibility and Efficiency | 3 | j/k/S/Enter, Bulk, Deep-Links; Accelerators nur auf /jobs |
| 8 | Aesthetic and Minimalist Design | 3 | strenge Dämpfung; 6 Interaktionen pro Job-Zeile, Toolbar stapelt 5 Steuerungen |
| 9 | Error Recovery | 3 | Copy-Disziplin Problem→Bewahrtes→Schritt; Bulk-Teilfehler unsichtbar |
| 10 | Help and Documentation | 3 | so-funktionierts ehrlich + kontextuell verlinkt; kein Hilfeeinstieg von /jobs selbst |
| **Total** | | **29/40** | **Good (72,5%)** |

Trend: 29 → 30 → 32 → 30 → 29. Befund-Masse sinkt deutlich; verbleibende Kritik ist Detail-Disziplin (Komponenten-Wiederverwendung), keine Fundament-Brüche mehr. Keine ungehaltenen Versprechen gefunden (SCORE_LIMIT=50, Cron, Zeitvertrag im Code belegt).

## Priority Issues (Runde 6)

**[P1] Bulk meldet Erfolg bei Teilfehlern** (jobs/page.tsx:176-198) — Promise.all ohne ok-Prüfung. Fix: Einzelergebnisse prüfen, Teilerfolg ehrlich melden.
**[P1] Job-Zeile als 6-facher Entscheidungspunkt** (jobs/page.tsx:666-735) — Product-Frage (provokante Frage 1, eine Entscheidung pro Karte). Fix-Kompromiss: Gewichtsdifferenzierung statt Abbau (die 4 Schnellbuttons waren ein bewusstes Runde-2-Feature) + Undo-Fenster verbreitern.
**[P2] ScoreBadge-Verstoß auf Detailseite** (jobs/[id]/page.tsx:491-503) — inline nachgebaut, text-5xl über Display-Token. Fix: ScoreBadge size xl.
**[P2] Resume-Upload-Label ohne Zuordnung** (resume/page.tsx:346-354) — htmlFor/id.
**[P2] Stille Hintergrund-Ladefehler** (search/page.tsx:162-171, resume/page.tsx:99-109, settings/page.tsx:163-190) — „konnte nicht geladen — erneut versuchen"-Muster.

## Deterministisch (B)

Public-Nav-Finding behoben (verifiziert: anonym nur Wortmarke + „Anmelden", /jobs = 307). Login-H1 verifiziert. Detektor 0 (dritte Runde in Folge). Einziger Rest: Footer auf /login + /register below the fold (dritte Runde konsistent) → Flex-Push.

## Minor (Runde 6)

„Archiv" vs. „Archiviert" · „Aktualisieren" ohne Pending · moreOpen aria-expanded-Mismatch · 16P maxLength=6 ohne Rückmeldung · „Job ansehen →" Pfeil im Linktext · line-through im Optimierungsvergleich (SR) · eingeloggte Nutzer nicht von /login weggeleitet · Live-Strom „Zu meiner Liste" vor Abschluss doppelklickbar · 7s-Undo zu kurz für Gehetzte · Google-Logo als Farbriss (Marke, vertretbar).

## Provokante Fragen (Product, unbeantwortet)

1. Launcher-Inszenierung statt entscheidungsfreudigem Weiterführen? 2. Ist die Admin-Fläche (8 Keys, 5 Provider, 6 Sektionen) das eigentliche Produkt geworden? 3. Score-Limit im Modell lösen statt erklären? 4. Warum ist der Score nicht einfach immer da (statt „Jetzt bewerten")? 5. Erfolgreichen Normalbetrieb emotional so sorgfältig enden wie Fehlerfälle?

## Fix-Runde 6

Bulk-Teilerfolg ehrlich, Schnellbuttons gewichtsdifferenziert + Undo 12s, ScoreBadge xl, Label-Fix, Ladefehler-Muster, Footer Flex-Push, Minor-Batch.
