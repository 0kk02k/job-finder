---
target: Unterseiten (search, jobs, job-detail, settings, resume, interview)
total_score: 13
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-09-03T09-37-22Z
slug: n-search-jobs-job-detail-settings-resume-interview
---
# Critique — Unterseiten (search, jobs, job-detail, settings, resume, interview), Erstlauf

Method: dual-agent (A: Design-Review-Subagent · B: Detector-Subagent). Keine Live-Inspektion (kein Browser-Tool; Auth-Gate ohne Credentials) — quellbasiert + kompiliertes CSS als Evidenz. Messung vor Commit 33ca0cd; P0-1 (Doppel-Bindestrich-Klassen, meine Regression aus dem Token-Sweep) wurde im Lauf behoben.

## Design Health Score

| # | Heuristik | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Sichtbarkeit des Systemstatus | 1 | PDF-Download ohne Label-Wechsel (`jobs/[id]:229–246`); Suche leert Liste ohne Skeleton |
| 2 | Passung zur realen Welt | 1 | „Ziel-Job-Titles", „Platform-Sync", „✓ Synced", „AI Match Score", „Transferable Skills" |
| 3 | Nutzerkontrolle | 1 | Suche schreibt jeden Treffer ungefragt in die Pipeline (`api/search:196–229`); Interview-Restart ohne Bestätigung |
| 4 | Konsistenz & Standards | 1 | Schwelle 8 vs. 7 vs. 0.7; Token-System in drei Zuständen; 9 Regenbogen-Paletten |
| 5 | Fehlervermeidung | 1 | Kein Dirty-Guard (Settings); unbekannter Status → still „Entdeckt" (`ui.tsx:95`) |
| 6 | Wiedererkennen statt Erinnern | 2 | Ergebnisse zeigen Pipeline-Status nicht; Keys ohne „ist gesetzt" |
| 7 | Flexibilität & Effizienz | 1 | 188 Jobs = 564 Status-Buttons; kein Bulk; Filter nicht in URL |
| 8 | Ästhetik & Minimalismus | 1 | Job-Detail ohne sichtbares System; Regenbogen auf jeder Ergebniskarte |
| 9 | Fehler erkennen & beheben | 2 | Gute 422 — UI toastet nur, bleibt im URL-Modus |
| 10 | Help & Dokumentation | 2 | Limit/Dauer/Tipp gut — minSalary ohne Hinweis trotz Score-Wirkung |
| **Total** | | **13/40** | **Poor** |

Max anwendbar: 40 (keine n/a). Kognitive Last: hoch (Settings: 8 Optionen am Key-Block, 3 Save-Buttons; /jobs: 12 Controls, 8 Chips). Emotional: Peak verschenkt (/jobs/new scored synchron, stummer Redirect), Talsore: API-Keys, Anschreiben, Interview-Restart.

## Design-Spezifität

Kategorieaustauschbar, nicht Feldnotizbuch: der Standard existiert in genau zwei Dateien (page.tsx, jobs/page.tsx: 0 var()), sieben Dateien sprechen eigenen Dialekt (408→~380 var()-Stellen; Regenbogen-Badges search:188–194; Tech-Beispiele settings:552, search:244, jobs/new:110,123; vier Containerbreiten gegen 1024px-Desk-Rule). Copy-Schicht ist mehr beim Produkt als die Gestaltung.

Deterministisch: CLI 0 Befunde (Exit 0, Positivkontrolle verifiziert) — die generischen 59 Regeln encoden nichts von diesem System. Named-Rule-Sweeps trugen das Signal: 408 var(), 27 kaputte Doppel-Bindestrich-Klassen jobs/[id] (behoben in 33ca0cd), 9-Hue-Regenbogen, 5 tabular-nums-Fehlstellen (search:390,422; jobs:214; interview:271; resume:292/settings:492), rounded-lg settings:442 / rounded-xl-Karte search:388, Breiten-Drift (5xl/4xl/3xl/2xl/md), Heading-Sprünge (h1→h3/h4), 0 alert(), 0 dark:. Kernvar(--background) 27× existiert nicht (Roh-Token heißt --paper) → transparente Inputs; focus:outline-none in 8 Dateien killt den Ocker-Ring.

Overlays: keine (kein Browser-Tool; Auth-Gate). Fallback: Quelle + kompiliertes CSS (bewies: .text--*/.bg--* existieren nicht).

## Stärken

1. Copy-Schicht auf Produkt: 15er-Limit als Limit benannt (search:333–340), 422 mit Handlungsanweisung (api/jobs:97).
2. /jobs spricht den Dashboard-Dialekt: motion-reduce-Skeleton, aria-pressed (jobs:263,428), zwei Empty States, Zähler+Reset.
3. Pipeline-Schutz als Implementierung: Re-Suche promoted nur aus DISCOVERED/SCORED, niemals über APPLIED/INTERVIEW (api/search:107–109,211–214).

## Prioritäre Probleme

1. **[P0 · behoben 33ca0cd] Job-Detail + Markdown ohne Design-System** — 27 Doppel-Bindestrich-Klassen (Score-Karte ohne Fläche/Kante; „Passt gut"=„Fehlt"), 7 in Markdown. Erledigt; Bleibt als Prozess-Lektion: Sweeps mit Detector verifizieren.
2. **[P0] Schwelle dreigeteilt** — jobs:285 Label „(≥7)" filtert auf 8 (:113); semantischer Pfad: relevanceScore ≥0.7 → score=round(relevance*10) + HIGH_MATCH (api/search:87,104,118,121,133) → khaki 7 neben grünem Top-Match-Badge. Fix: eine Quelle der Wahrheit in lib/matching.ts (Relevance→1–10 oder SEMANTIC_HIGH_MATCH=0.8), Label aus Konstante, Such-Badge „Vorab-Match 70 %". Kommando: `$impeccable clarify`.
3. **[P0] Anschreiben** — statische Boilerplate (lib/pdf.ts:107–131), data.title nie gesetzt → „Als  verfüge ich über …" in jedem Brief; generateCoverLetter (lib/ai.ts:371) toter Code; kein Preview. Fix: KI-Pfad anbinden, editierbarer Markdown-Block mit Score-Stärken vorbelegt, „Erzeugen → Preview → Als PDF"; Mindestfix: Satz reparieren + Preview. Kommando: `$impeccable shape` dann Umsetzung.
4. **[P1] Settings-Key-Wand** — 8 Felder immer sichtbar, Placeholder-Instruktionen, GET /api/settings liefert Keys im Klartext (api/settings:29–41), 3 Save-Buttons, Profil-Save toastet ohne Senden; focus:outline-none (8 Dateien), var(--background) 27×. optimizeProfile-Fallback `['Software Engineer']` (settings:212). Fix: provider-gated Felder, „Gespeichert: ••••4f2a — ändern", Verbindungstest, ehrliches Save-Modell, Keys nie im Klartext. Kommando: `$impeccable simplify` + `$impeccable audit`.
5. **[P1] Kontrolle + A11y** — Interview-Restart ohne Bestätigung/Fehlerbehandlung (interview:274–279), Ignore ohne Undo (search:434–439), Resume-Abbrechen still (resume:274–278), ungefragte Pipeline-Writes; Suchergebnis → Detail fehlt; null A11y-Primitiven auf allen neun Seiten (Chat ohne role="log"), Score auf /jobs nur Farbe, Dropzone ohne Tastatur. Kommando: `$impeccable harden` + `$impeccable audit`.
6. **[P2] System-Riss** — ~380 var(), Regenbogen→neutraler Badge mit Source-Label (wie Dashboard), Breiten auf 1024px-Desk-Rule, Radien, tabular-nums, Emoji-Icons, Heading-Ordnung. Kommando: `$impeccable polish`.

## Persona-Rotpunkte

- **Alex:** kein Bulk/Mehrfachauswahl (564 Buttons); Suchergebnis→Detail unmöglich; Filter nicht in URL; kein Ent-Ignorieren (ARCHIVED Einbahnstraße).
- **Sam:** null A11y-Primitiven (sr-only/role/aria-live = 0 über alle neun); Chat unsichtbar für Screenreader; Score nur Farbe (scoreLabel existiert, unimportiert); Dropzone ohne Tastatur; Labels fehlen (Sortier-select, Suchfeld, Key-Gruppe).
- **kein-Tech-Profil:** Settings überlebenskritisch und englisch (5 Key-Marken, „Ziel-Job-Titles", „Platform-Sync"); Beispiele „Software Engineer"; optimizeProfile-Fallback optimiert Pflege-Profil auf Tech-Keywords stillschweigend; „Resume" vs „Lebenslauf".

## Kleinere Beobachtungen

{job.location || 'Remote'} erfindet Remote (jobs:346) · toast.error('Fehler: ' + error) (jobs/[id]:102, jobs/new:42) · „• Berlin" ohne Firma · {job.score && …} bei Score 0 (jobs/[id]:152) · kein loading.tsx pro Unterseite (Root greift bei Client-Fetch nie) · Toast 4 s ohne Hover-Pause · Register ohne Passwort-Regel · „✓ Synced" · Chat-Bubble in Stein · Beschreibungen text-sm statt Body 1rem · minSalary ohne Help-Text · Emoji als Iconsystem (📄💡🤖⚠️).

## Zu überlegen

1. Woran ist „messbar besser als die Großen" erkennbar, wenn das Anschreiben eine Vorlage mit leerem Berufsfeld ist?
2. Ein System mit einem Standard — oder eine Seite mit einem Standard und acht Mitbewohnern?
3. Wen bricht die ungefragte Pipeline-Übernahme: die Suche — oder die Person, die sie zum zweiten Mal benutzt?
