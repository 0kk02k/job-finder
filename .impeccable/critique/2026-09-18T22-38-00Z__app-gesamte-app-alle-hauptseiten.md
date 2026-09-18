---
target: app — gesamte App (alle Hauptseiten)
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-09-18T22-38-00Z
slug: app-gesamte-app-alle-hauptseiten
---
Method: dual-agent (A: agent-9 frischer Explore · B: agent-7 resume Detektor+Browser)

## Design Health Score (A, blind @ 4e2bce0)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Stufen-Panel, „Gespeichert um HH:MM", Undo-Toasts; Lücken: Dashboard-Refresh ohne Busy, Google-Login hängt bei Fehler |
| 2 | Match System / Real World | 3 | Alltagssprache; Lecks: „Zero Data Retention", „High Matches"-Jargon |
| 3 | User Control and Freedom | 3 | Undo, Snapshot-Restore, Dirty-Guard; Lücke: Anschreiben-„Verwerfen" ohne Confirm |
| 4 | Consistency and Standards | 3 | Score 4× unterschiedlich dargestellt (jobs/page.tsx:698 nackte Zahl · page.tsx:549 „9/10" · search/page.tsx:905 „Score 9/10 · Wort" · applications/page.tsx:104 Zahl+title) |
| 5 | Error Prevention | 3 | zweistufig destruktiv; kein Confirm bei „Abgelehnt" (dafür 7-s-Undo) |
| 6 | Recognition Rather than Recall | 3 | Chips sichtbar; „N neu" nur auf dem Dashboard, nicht an denselben Suchen auf /search |
| 7 | Flexibility and Efficiency | 3 | Shortcuts, Bulk, Deep-Links; keine Presets |
| 8 | Aesthetic and Minimalist Design | 3 | ruhig; Rauschen: 4 Quick-Status × N Karten, Toolbar 11 Kontrollen |
| 9 | Error Recovery | 3 | Ursachen getrennt; schwach: vages „Fehler beim Speichern" auf /resume, Google-Login-Totzustand |
| 10 | Help and Documentation | 3 | /so-funktionierts ehrlich; kein kontextuelles Help auf Interview/Preferences |
| **Total** | | **30/40** | **Good (75%)** |

Trend: 29 → 30 → 32 → 30 (Reviewer-Wechsel, strengere Konsistenz-/Recovery-Linse; Befund-Menge sinkt, Rest ist Detailarbeit).

## Priority Issues (Runde 5)

**[P1] Score-Anzeige in vier Varianten** — Fix: ScoreBadge-Komponente (Zahl + /10 + Wort + sr-only) in ui.tsx, alle vier Stellen umstellen.
**[P1] Google-Login ohne Fehlerpfad** (login/page.tsx:15-19, register/page.tsx:16-20) — setLoading ohne catch/reset → permanenter „Wird angemeldet"-Zustand. Fix: signIn-Ergebnis prüfen, Fehlermeldung + Reset.
**[P1] Job-Detail endet in der Textwand** (jobs/[id]/page.tsx:850-859) — rohe Anzeige ohne abschließende Handlung. Fix: Anzeigentext hinter Disclosure, Seitenende mit Rückweg.
**[P2] Anecdote-Chooser unbegrenzte Radio-Liste** (jobs/[id]/page.tsx:606-650) — Fix: Top-3-Karten + „Aus allen wählen"-Disclosure.
**[P2] „N neu" fehlt auf /search** (page.tsx:621-625 vs. search/page.tsx:442-453) — Fix: lastNewJobs-Badge in den SavedSearch-Chips.
**[Det B] Öffentliche Seiten rendern App-Nav** — anonyme Nutzer sehen Suchen/Jobs/…/Logout → alles 307. Fix: Public-Nav (Marke + Login) für anonyme Nutzer.

## Minor (Runde 5)

- „+ Job hinzufügen": „+" aria-hidden · Dashboard-Belegzeile grammatisch holprig · kein Zurück-Link auf Job-Detail · Login-H1 = Wortmarke statt „Anmelden" · Button-Class-Duplikation auf /resume, /search, /jobs (DESIGN.md-Do verletzt) · Anschreiben-„Verwerfen" ohne Confirm · /resume teilt sich ein downloading-Flag · Auto-Save-Haken nur per title-Tooltip erklärt (Touch unsichtbar) · /so-funktionierts „bis zu 50 Treffer" hardcoded (Drift-Risiko zu SCORE_LIMIT).

## Persona-Red-Flags (Runde 5)

- Alex: Shortcuts-Hinweis 11px/mobile unsichtbar · 7-s-Undo-Fenster zu kurz für Gehetzte · Auto-Save-Tooltip touch-unsichtbar · Forced-Wait bei 30–60-s-Suche · Launcher-Frage pro Login.
- Sam: Doppelklick umgeht 4–5-s-Confirms (wird gefunden — „Neu starten" löscht 15–20 Min) · „Verwerfen" verwirft getippte Edits ohne Confirm · Suchen-Chips feuern sofort mehrere Läufe.

## Provokante Fragen (Product, unbeantwortet)

1. Rückstand als passives Geschehen statt aktiver Arbeitsort? 2. Zahl als Primärmetrum — oder Begründung zuerst? 3. Echter unbegrenzter Undo statt zeitgestempelter Reibung? 4. Arbeitsplatz (Bewerben) ans Ende statt Urteil→Unterlagen→fremde Textwand? 5. Einheitliche Chat-Sprache statt drei KI-Dialekte?

## Assessment B (Runde 5)

Detektor: 0 Befunde. Proxy-Verifikation: /so-funktionierts, /impressum, /datenschutz = 200 (Korrektur bestätigt), /jobs = 307, Auth-Wall intakt. Kein Overflow auf 5 öffentlichen Seiten × 2 Viewports, Fokus-Stile sichtbar, Skip-Link erste Tab-Position. Footer Login/Register below the fold (bekannt). Screenshots: shots-runde5/.

## Fix-Runde 5

Umgesetzt im Folge-Commit: ScoreBadge, Google-Login-Fehlerpfad, Anzeigen-Disclosure + Rückweg, Chooser Top-3, „N neu" auf /search, Public-Nav, Minor-Batch.
