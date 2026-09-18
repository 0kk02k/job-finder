---
target: app — gesamte App (alle Hauptseiten)
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-09-18T16-28-15Z
slug: app-gesamte-app-alle-hauptseiten
---
Method: dual-agent (A: agent-0 · B: agent-1)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | NDJSON-Stufung vorbildlich; saveCurrentSearch verschluckt Fehler still; Status-PATCH ohne Busy-Indikator |
| 2 | Match System / Real World | 3 | Deutsch durchgängig, Berufs-nahe Placeholder; Lecks: „KI-Suche (semantisches Matching)", rohe „Suchfächer"-Zeile |
| 3 | User Control and Freedom | 3 | Abbrechen mit Snapshot-Wiederherstellung, zweistufige Confirms, Dirty-Guard; kein Undo für Statuswechsel |
| 4 | Consistency and Standards | 3 | Shared Components, ein Score-Vokabular; handgerollte Button-Duplikate, text-surface statt text-on-accent |
| 5 | Error Prevention | 4 | Destruktives zweistufig, beforeunload-Guard, Constraints, kein Auto-Apply |
| 6 | Recognition Rather Than Recall | 3 | Gespeicherte Suchen sichtbar, Status badged; kein Rückweg-Kontext auf Job-Detail |
| 7 | Flexibility and Efficiency | 2 | Keine Shortcuts, keine Bulk-Aktionen, Batch-Scoring hinter Filter versteckt |
| 8 | Aesthetic and Minimalist Design | 2 | JobCard und Jobs-Toolbar überladen (4 Chip-Gruppen + Box + Snippet + 3 Aktionen; 13 Kontrollen an einem Punkt) |
| 9 | Error Recovery | 4 | Fehler nennen Ursache und Ausweg, Chat-Eingabe zurückgeholt, Synthese-Ausfall ohne Verlust |
| 10 | Help and Documentation | 2 | /so-funktionierts existiert, aber nur über Footer + Onboarding erreichbar — nicht kontextuell |
| **Total** | | **29/40** | **Good (72,5%)** |

## Design Specificity Verdict

Klar authored, nicht austauschbar: dokumentiertes „Feldnotizbuch"-System wird im Code tatsächlich eingehalten (Zwei-Stifte-Regel, Beweiszeilen statt Nacktzahlen, Launcher aus echtem Datenzustand, deutsche Status-Pills mit gedämpften Tints). Charakter lebt in Inhalts- und Zustandsentscheidungen, nicht in Grundgeometrie — für „quiet notebook" richtig.

Deterministic scan: CLI-Detektor über den gesamten app/-Baum sauber (0 Findings). Browser-Overlay: 1 Finding auf /register (cramped-padding) — vermutlich False Positive (Card hat p=6, Detektor misst inneres div isoliert). /login sauber.

## Overall Impression

Das Fundament ist stark: Ehrlichkeit, Zustandsführung und Fehlerbehandlung sind überdurchschnittlich. Die größte Chance liegt in der Dichte der zwei häufigsten Flächen (JobCard, Jobs-Toolbar) und darin, Hilfe und Beschleuniger an die Stellen zu bringen, wo die Fragen entstehen.

## What's Working

1. Launcher & Onboarding: zustandsabhängige Optionen statt starrem CTA, null falsche Vorwürfe, eine Primäroption.
2. Fortschritts-Panel der Suche: Quellentransparenz, Zeitvertrag, Live-Karten, Abbrechen mit Wiederherstellung — Wartezeit wird zu Information.
3. Ehrliche, zustandserhaltende Fehlerbehandlung: Chat-Eingabe zurückgeholt, Suche-Snapshot, zweistufige Confirms mit Timeout, Toasts mit Hover-Pause.

## Priority Issues

- [P1] Kontroll-Wand Jobs-Toolbar (app/jobs/page.tsx:270-380): 8 Status-Chips + Checkbox + Segment + Suche + Sorte an einem Entscheidungspunkt (>12 Optionen). Fix: auf 3–4 Kernstatus kollabieren, High-Match-Checkbox ins Segment auflösen. → distill
- [P1] JobCard-Dichte (app/search/page.tsx:799-929): bis zu 4 Chip-Gruppen + Begründungsbox + Snippet + 3 Aktionen; Score doppelt. Fix: Chips kürzen + „mehr"-Toggle, Begründung einklappbar, Aktionen hierarchisieren. → distill
- [P2] Kein Power-User-Pfad: keine Shortcuts, keine Bulk-Aktionen, Batch-Scoring hinter filter=unscored. Fix: j/k/s/a-Shortcuts, Mehrfachauswahl, sichtbarer Rückstand-Button. → optimize
- [P2] Hilfe nicht kontextuell: /so-funktionierts nur über Footer + Onboarding. Fix: Inline-Hinweise mit Link an Score-Limit-Zeile, Auto-Save-Label, Jobs-Toolbar. → clarify
- [P2] Emotionale Täler ohne Aufgang: leere Suche = generischer Einzeiler; REJECTED ohne nächsten Schritt. Fix: konkrete Hebel bei Leer-Treffer, Weiter-Hinweis nach Absage. → delight

## Persona Red Flags

**Alex (Power User):** Keine Shortcuts; Ignore nur pro Karte, kein Mehrfach-Selekt; Batch-Scoring verbirgt sich hinter Filter. Positiv: Deep-Links und Auto-Run gespeicherter Suchen existieren — sollten offiziell sichtbar sein.
**Sam (Accessibility-Dependent):** Fundament stark (Skip-Link, sr-only Labels, Fokusring, role=log), aber: text-primary-soft ≈ 3,4:1 Kontrast auf kleinem Metatext (unter WCAG AA); zeitkritische Confirms ohne Verlängerung (4s Ignore / 5s Restart); Toast-Schließen 14px-Icon ohne großes Target.
**Nele (projektspezifisch, PRODUCT.md: gemischte Berufe, keine Tech-Nutzer):** „KI-Suche (semantisches Matching)" und rohe „Suchfächer"-Zeile ohne Erklärung; Settings-Wand (6 Sektionen inkl. API-Keys); Resume-Edit als rohe Markdown-Textarea; 16Personalities-Karte dominiert Interview-Seite.

## Minor Observations

- Footer-Rechtsseiten (/so-funktionierts, /impressum, /datenschutz) liegen hinter der Auth-Wall (proxy.ts) — für die private Instanz unkritisch, aber eingeloggte-Umleitung erwartungswidrig.
- Login-Titel „Job Finder" ohne Bindestrich vs. Marke „Job-Finder".
- text-surface statt text-on-accent auf Accent-Buttons in Interview/Preferences (Dark-Mode-Inkonsistenz).
- Batch-Fortschrittsbalken nutzt gefilterten Nenner, Server bewertet globalen Rückstand — irreführend.
- „Weiter im Onboarding" erscheint nach Interview-Abschluss auch bei etablierten Nutzern.
- Resume-Kopf: vier gleichgewichtige Buttons; Ersetzen verdient nicht denselben Rang.

## Questions to Consider

1. Was, wenn die App an einem schlechten Tag statt Wahlmöglichkeiten einen einzigen sinnvollen nächsten Schritt anbieten würde?
2. Was wäre eine Version, die die Begründung an erste und die Score-Zahl an dritte Stelle setzt?
3. Was, wenn „KI verbinden" ein einziger geführter Dialog statt einer Settings-Seite wäre?

## Run Notes

- Ziel-Slug: app-gesamte-app-alle-hauptseiten; kein ignore.md.
- Assessment-A (Design Review) und B (Detektor+Browser) als isolierte Sub-Agents parallel, keine gegenseitige Sichtung vor Fertigstellung.
- CLI-Detektor: komplett app/ gescannt, 0 Findings, Exit 0.
- Browser: Playwright-Chromium via executablePath-Fallback (Cache 1234 vs. erwartet 1228). Auth-Wall (proxy.ts) blockt alle Seiten außer /login und /register — Arbeitsseiten nicht screenshot-bar, dokumentiert statt bekämpft. Overlay auf beiden erreichbaren Seiten: /login sauber, /register 1 Finding (False Positive wahrscheinlich).
- Cleanup: Dev-Server gestoppt, live-server gestoppt, /tmp-Skripte und Screenshots liegen unter /tmp (Projekt unverändert); keine Temp-Dateien im Repo.
