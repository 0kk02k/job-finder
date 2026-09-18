# Handoff — Stand 02.09.2026 (Abend)

> **→ Aktuell (18.09., spät): Impeccable-Runde 4 läuft — Score 32/40 (Snapshot `.impeccable/critique/2026-09-18T21-20-36Z__*.md`, alle Findings + Personas + provokante Fragen dort). Teil-Fixes gepusht (`1fcc739`): Undo-Toast für Status-Wechsel inkl. `undoRejectedAt`-Vertrag, `isBacklogJob` als einzige Rückstand-Definition, Onboarding 3+4 zusammengeführt, Anker-Link. REST-BACKLOG Runde 4 unten in Update III. Ziel (Critique-Runden-Schleife) ist pausiert, nicht abgeschlossen — ÜBERNAHME: Update III lesen, dann Snapshot lesen, dann Rest-Backlog abarbeiten.**

> **Update 18.09.2026 (III — Übernahme-Doku für Runde 4, Stand Push `1fcc739`):**
>
> **Methode (für Fortsetzung identisch nutzen):** Dual-Agent — A = frischer Explore-Agent, blind, liest `reference/critique.md` (Skill: /home/okko/.agents/skills/impeccable/, Rubrik + Output-Vertrag) + DESIGN.md + PRODUCT.md, bewertet alle Hauptseiten, 0 Vorwissen über frühere Runden. B = Detektor + Browser (`node /home/okko/.agents/skills/impeccable/scripts/detect.mjs --json app`; Dev-Server Port 3100; Playwright-Chromium braucht `executablePath`-Workaround auf `~/.cache/ms-playwright/chromium_headless_shell-1234/...`). Auth-Wall: nur /login + /register öffentlich (s. Rest-Punkt 4). Slug: `app-gesamte-app-alle-hauptseiten`, kein ignore.md. Score-Verlauf: 29 → 30 → **32/40**.
>
> **Runde 4 bereits umgesetzt (`1fcc739`, 163/163 Tests grün):** Undo-Toast mit Aktion für jeden Status-Wechsel (Toast-Komponente hat jetzt Action-Support; PATCH-Vertrag `undoRejectedAt: true` löscht rejectedAt nur bei Rücksprung von REJECTED, jünger 60 s — Absage-Statistik bleibt ehrlich); `isBacklogJob()` in lib/status.ts als einzige Rückstands-Definition (Dashboard, /jobs, score-batch); Onboarding-Schritte 3+4 → ein Schritt „Jobs suchen und bewerten lassen"; „Warum gibt es Reste?"-Link zeigt jetzt auf den Anker `#bewertungs-limit` auf /so-funktionierts.
>
> **REST-BACKLOG Runde 4 (alle mit Datei:Zeile im Snapshot, Priorität absteigend):**
> 1. **[P1]** Suchergebnisliste: „Ansehen" je Karte als Ocker-Button → dezenter Textlink; „Zu meiner Liste" einzige Button-Fläche (app/search/page.tsx:950-957). Begründung: 15 Ocker-Flächen pro Liste brechen „ein Ocker pro Viewport".
> 2. **[P2]** 16Personalities-Karte: Zustands-Gate — nur vor Interview-Start, nie im aktiven Chat/nach Abschluss (app/interview/page.tsx:367-411).
> 3. **[P2]** Autospeichern sichtbar: „Gespeichert um HH:MM" nach Blur-Patch (app/jobs/[id]/page.tsx:817-825, app/applications/page.tsx:134-142).
> 4. **[Det, wichtig]** proxy.ts:12 — /so-funktionierts, /impressum, /datenschutz im Matcher freigeben (heute Redirect auf /login trotz Footer-Links; Browser-verifiziert). Danach curls prüfen.
> 5. **[Det]** Auth: Labels htmlFor/id (login + register); login/page.tsx:32-35 Fehlerrolle role="alert"; register/page.tsx:56 Catch-All präzisieren.
> 6. **[Klein]** a) jobs/page.tsx:104-106 Fetch-Fehler → Error-State statt still „0 Jobs"; b) Batch-Rest-Hinweis nach 20-Lauf-Grenze (jobs/page.tsx:271); c) „+ Suche speichern" als Ocker-Primary am Lauf-Ende (search/page.tsx:696-706); d) applications Empty-State-CTA → /jobs statt high_match-Filter (applications/page.tsx:277-288); e) resume/page.tsx:355 „..." → „…"; f) preferences/page.tsx:355 line-through zusätzlich SR-freundlich kennzeichnen.
> 7. Nach Abschluss: verifizieren (tsc, npm test, build, lint-Vergleich), commit, push, dann Runde 5 starten (Score-Ziel: ≥34). Provokante Product-Fragen im Snapshot §„Provokante Fragen" — vor Runde 5 nicht lösen, aber als Prüffragen mitdenken.
>
> **Bewusst offen (NICHT als Finding behandeln):** Altbestand-Lint in lib/apify.ts/platforms.ts/autoapply.ts; experimenteller Portal-Sync (Product-Entscheidung, provokante Frage 5); durchsuchbare Hilfe; Product-Fragen 1–4.

> **Update 18.09.2026 (Nachfolge-Session, alles gepusht):** 1) **Plan B verifiziert** — `NEBIUS_SCORING_MODEL='moonshotai/Kimi-K2.6'` + `noThinkingFetch` (`chat_template_kwargs.thinking:false`, SDK reichts nicht durch); prod-Suche: 0→40 bewertete Jobs. 2) **DOCX-Upload** repariert (`lib/docx.ts`, jszip — vorher rohe UTF-8-Dekodierung). 3) **Erklärseite `/so-funktionierts`** (Footer + „Erste Schritte"). 4) **Zwei Critique-Läufe** (29/40 → 30/40), alle Priority Issues gefixt in drei Paketen: Toolbar-Dichte, JobCard-Kürzung, Shortcuts S/J/K/Enter, Mehrfachauswahl, „Rückstand bewerten", Erklärlinks, Leere-Suche-Hebel, Absage-Trichter, **Settings-Save-Modell + docTemplate-Persistierung** (war toter Endpunkt), Bewerben-Gruppe auf Job-Detail, Gespräch→Interview, Interview-Neustart-Confirm, Chat-Scroll, „+ Suche speichern" bei 0 Funden, Toasts. 5) **Kontrast:** `--stone-soft` light → `#6b645e` (AA ≥4,5:1, DESIGN.md nachgezogen). 6) **Settings in Alltagssprache** + **16Personalities-Karte** auf der Interview-Seite. 7) **Werkstudent-/Praktikums-Filter** deterministisch im Scoring (Score ≤ 3 mit Begründung, kein LLM-Call; semantisch ≤ 0,3), 11 neue Tests. **Tests: 147 grün**, tsc/build sauber. Offen: Vercel-Env-Key, Werkstudent-Backfill, Zwei-Phasen-Interview-Merge.

> **Update 18.09.2026 (II, gepusht):** 1) **Werkstudent-Backfill**: 2 Alt-Jobs (Score 9) → 3, Script hinterlegt unter `scripts/backfill-entry-level.ts`. 2) **HR-Interview-Paket** (löst die offenen Interview-Defekte): alle KI-Calls über `generateTextGuarded` (60s/120s, deadline aus der Route, „Die KI antwortet gerade nicht — versuch es gleich nochmal."); Abschließen-Zwei-Klick + `finish:true`-Vertrag — Substring-Filter ersetzt durch den geteilten `filterVerifiedEvidence` (Wortlaut ODER Paraphrase ≥ 80 % Token); Agenda-Dedupe gegen `preferenceProfile` + Anekdoten (geklärte Themen zählen nicht als offen, laufen als „BEREITS GEKLÄRT"-Kontextblock ins System-Prompt); Report füllt Anekdoten in die bestehende Form (PDF-Pfad stabil); Zwei-Phasen-Einstieg auf /interview (Phase 1 → /preferences mit Erledigt-Zustand, Phase 2 → HR-Chat, 16P-Karte danach); `resynthesize`-Retry bei Auswertungs-Ausfall; DELETE verwirft wirklich alle Sessions (Confirm-Text „Akte mit allen Antworten wird gelöscht" deckt das). **Tests: 162 grün** (17 neue in `tests/lib/interview.test.ts`), tsc/build sauber. Offen: Vercel-Env-Key; Re-Critique nach echter Nutzung.

> **Update 14.09.2026:** Fünf Pakete, alle gepusht (Tests: 121 grün). 1) **Präferenz-Gespräch** (`5245b07`): Dead-End „1 von 4" gefixt — Evidence-Filter akzeptiert Fuzzy-Belege (≥80 % Token, `lib/preference-profile.ts`), alle 3 KI-Calls auf `generateTextGuarded`, `POST {finish:true}` + Abschließen-Button (Zwei-Klick, zeigt offene Themen). 2) **Copy-Pass** (`bd4883d`): Füllersätze/Dubletten raus (−23 Zeilen); **Datenschutz-Wahrheit**: „nichts verlässt diese App" war falsch (Lebenslauf-/Anzeigen-/Gesprächstexte gehen an den eigenen KI-Provider) — Startseite + Datenschutzerklärung jetzt präzise, Interviews/Transkripte explizit erwähnt. 3) **Onboarding-Wegweiser** (`47129de`): Zusammenfassungsseiten führen zurück, Onboarding-Schritte 3+4 haben Buttons. **Uncommitted:** Umbenennung zu „Weiter im Onboarding" (beide Interview-Seiten) — wartet auf Freigabe. 4) **Suche 60s** (`5c2f909`): Query-Fächer + Pool-Ranking von Kimi-K3 auf GLM-Flash/Guard, alle 7 Plattform-Fetches mit 15s-Timeout. 5) **50s-Deadline** (`245712c`): Runtime-Log bewies Provider-Stall auch auf Flash (Fan 2×25s) + hängende ungeschützte Scorings → Lauf trägt Gesamtfrist 50s/10s Puffer, Fan 10s ohne Retry, Ranking 30s ohne Retry, Zweitrunde nur mit Restbudget, Scoring mit Guard + max. 8 parallel + Frist-Abbruch (nächtlicher Cron scoriert Reste), BA-Details 20s-Deckel; **Teilergebnisse statt 504**. Neu: „Zu meiner Liste"-Button auf jeder Trefferkarte, `POST /api/jobs` übernimmt vorhandenen Score ohne Neu-Scoring. 6) **Suche-Frist hart gemacht** (`9c680f0`): Zweiter Runtime-Log-Beweis — beide Ranking-Chunks (à 60!) starben gleichzeitig am 30s-Guard, der Fall-through fetchte alles doppelt, und kurz vor der Frist gestartete Scorings überstanden sie um ihre vollen 25s+Retry → 60s-Kill, Stream endete ohne Ergebniszeile. Fixes: Ranking-Chunks 60→15 (8 parallel), Kompakt-Vertrag im Ranking-Prompt (Reason max. 1 Satz, max. 3 Skills), `deadline` als 4. Guard-Param kapppt jeden KI-Call an der Gesamtfrist (`attemptTimeoutMs` in `lib/ai.ts`), Fall-through nur noch mit Restbudget (`phaseFitsInBudget`), beide Upsert-Schleifen fristgebunden. 7) **Live-Strom + Diagnose** (17.09., uncommitted): **Die eigentliche Wurzel ist der Provider, nicht der Code** — DB-Beweis: 0 Jobs mit Score *je*; Prod-Calls hängen seit ~13.09 an jedem Guard (TimeoutError), während ohne Key in 0,0s `AI_LoadAPIKeyError` käme → in Vercel steckt ein `NEBIUS_API_KEY` (Secret, nicht pullbar), **mit dem jeder Call hängt**. Nutzer prüft Nebius-Konto und legt frischen Key in den **Einstellungen** ab (Settings-Key schlägt Env, kein Redeploy). Code: `semanticSearch` streamt pro fertigem Chunk via `onRanked` (neue NDJSON-Zeile `jobs`, Karten erscheinen sofort, `mergeStreamedJobs` dedupliziert), `onPool` hält den Kandidatenpool fest — Ranking-Totalausfall zeigt jetzt den Pool **ungeranket** statt einer Fehlerwand (`rankingFailed`-Flag, nichts gespeichert); Fehler bleibt nur bei leerem Pool. Tests: 132 grün (3 neu). **Konto wurde am 13.09. auf Wunsch komplett geleert** (Prod-DB, Login-Zeile blieb; Skript-Pattern: `PrismaNeon`-Adapter nötig, Prisma 7) — Nutzer durchläuft alles frisch; Live-Beweise für Fuzzy-Abhakungen und Deadline-Suche stehen noch aus. **HR-Interview hat dieselben 3 Defekte unverändert** (keine Guards, Substring-Filter inline `lib/interview.ts:237ff`, kein Abschließen-Button; `maxDuration=300` dort). **Beschlossener nächster Schritt:** Zwei-Phasen-Merge der Interviews designen (Phase 1 = Präferenzen mit sofortigem Suchwert, Phase 2 = HR-Teil optional, deduped Agenda, STAR → Anekdoten).

> **Update 08.09.2026:** Drei Pakete (ungepusht bis auf sonst): 1) Sprache (gepusht `0543466`/`db69689`): Anzeigen-Sprache steuert Anschreiben + Lebenslauf-Download (`lib/language.ts`, strikte KI-Übersetzung nur für den Download, ehrlicher 503). 2) Status-Wechsler: Abgelehnt-Button, Wechsler auf Job-Detail, `appliedAtFor`-Regel (`lib/status.ts`), deutsche Aktivitäts-Texte. 3) Interview: Eingabe-Fix (gepusht `1893237`), Auswertung als themengebundenes PDF (`POST /api/pdf` type `interview-report`, nichts persistiert), Mini-Aufgaben-Katalog fachrichtungsoffen (Fallvignette/Priorisierung/Erklärung/Rollenspiel/Dokumentation statt Code-Review-Anker). Tests: 55 grün (`npm test`). Offen weiter: Re-Kritik `/search`, Live-Suchlauf, Bulk-Scoring.

> **Update 03.09.2026:** DB-Migration ist durchgeführt (`prisma db push --accept-data-loss`, danach Settings-Zeile auf `nebius`/`moonshotai/Kimi-K2.5` migriert — verifiziert). Die App ist nicht mehr schema-seitig gebrochen. Erledigt damit: alles unter „ZUERST". Weiter offen: lokaler Nebius-Key, Modell-ID-Verifikation, Bulk-Scoring (jetzt „Stufe 2" des Hero-Plans), Minor-Liste. Critique Lauf 5 lief am 03.09. (24/40, Snapshot in `.impeccable/critique/`), dessen Fixes sind im selben Commit wie die Migration.

Zustand nach dem heutigen Design-Tag: 4 Critique-Läufe am Dashboard (13 → 24 → 24 → 28/40), alle gefundenen Punkte bis auf einen (P2 „Bedienpult") umgesetzt, Text-Rendering repariert, KI-Provider auf Nebius/Kimi K2.5 umgestellt.

## ⚠️ ZUERST: DB-Migration ist offen — App ist bis dahin funktional gebrochen

Der Code referenziert bereits `nebiusApiKey` / `aiProvider='nebius'` (Schema in `prisma/schema.prisma` geändert, Prisma-Client regeneriert), aber die **Neon-DB hat das Schema noch nicht**. Ohne Migration laufen `/api/search`, `/api/interview` und die Settings-Seite auf Fehler (Spalte existiert nicht).

Der Push wurde vom Permission-Classifier bewusst gestoppt (`--accept-data-loss` gegen echte Nutzerdaten = Nutzerentscheidung). Selbst ausführen:

```bash
npx prisma db push --accept-data-loss
```

Danach bestehende Settings migrieren (1 User, 1 Settings-Zeile):

```bash
node --env-file=.env -e "
const { PrismaClient } = require('@prisma/client')
const { PrismaNeon } = require('@prisma/adapter-neon')
;(async () => {
  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) })
  const r = await prisma.userSettings.updateMany({
    where: { aiProvider: 'mistral' },
    data: { aiProvider: 'nebius', aiModel: 'moonshotai/Kimi-K2.5' },
  })
  console.log('migriert:', r.count)
  await prisma.\$disconnect()
})()
"
```

Nebenwirkung: die Spalte `mistralApiKey` (alter Mistral-Key) wird gelöscht — bewusst, Provider ist raus.

## Nach der Migration

1. **Commit**: alle Änderungen liegen uncommitted im Working Tree (8 Dateien Code + DESIGN.md, siehe `git status`) — nach der Migration in einem Zug committen. `main` liegt bereits 6 Commits vor origin, **nichts gepusht** (bewusst).
2. **Lokaler Key**: `.env` hat `NEBIUS_API_KEY=` (leer). Der echte Key liegt nur in den Vercel-Env-Vars. Für lokales Scoring/Interview den Key lokal eintragen — sonst schlägt die KI-Anbindung lokal fehl (Deployment auf Vercel funktioniert, sobald gemigriert + gepusht ist).
3. ~~**Modell-ID verifizieren**~~ **Erledigt 07.09.2026:** Der 404 in Produktion bestätigte die Befürchtung — Nebius hat `moonshotai/Kimi-K2.5` gesunset (Docs-Beispiele sind veraltet). Jetzt `moonshotai/Kimi-K3` an allen drei Stellen (`lib/ai.ts`, Schema-Default, Settings-Zeile der DB per UPDATE). Künftig Modell-IDs immer gegen `api.tokenfactory.nebius.com/v1/models` prüfen, bevor sie hier landen.

## Heute erledigt (Details in den Commits/Reports)

- **Such-Button-Overflow** (`17a3ce5`): `min-w-0`-Fix, Button ragte auf md+ und Mobil aus der Karte.
- **Critique-Läufe 2–4** (dual-agent, Snapshots in `.impeccable/critique/`): 13 → 24 → 24 → 28.
- **Dashboard-Iteration** (`04af0a5` + uncommitted): 401-Eigenzustand, Partial-Failure-Trennung, Angebot-Hero (5 älteste unbewertete + Widerwort), Belegzeile syncron zum /jobs-Zähler, AA-Token-Architektur (Roh-Tokens `--paper/--stone/--ochre`, `@theme` ohne Zirkularität), Onboarding mit einem current-Schritt, Beweiszeilen („Passt auf: …"), Fold-Fixes (CTA über der Liste, Karte direkt unter Hero).
- **Text-Rendering** (uncommitted): `normalizeTextContent`/`textSnippet` in `Markdown.tsx`; Job-Detail-Beschreibung und Such-Snippets ohne Entities/Bullet-Artefakte.
- **Provider-Wechsel** (uncommitted, Code fertig): Nebius Token Factory als Default, Mistral aus lib/Routen/Settings/Schema entfernt.

## Offen (bewusst nicht heute)

- **P2 „Bedienpult"** (Critique Lauf 4): kein Refresh-Control, 20 Tab-Stops bis CTA, keine Aktionen in den Hero-Zeilen. Braucht `shape`-Termin + Produktscheidung Bulk-Scoring (kein Scoring-Endpunkt für Bestands-Jobs) — spielt mit dem Provider-Wechsel zusammen.
- Minor: „Resume" (Nav) vs „Lebenslauf" (Fläche), „Job Finder" vs „Job-Finder", Skeleton 204px vs Hero 813px, Sidecar-Tonal-Ramps stammen aus der Erst-Dokumentation (nur kanonische Werte aktualisiert).
- Critique-P2-Empfehlung: nächste Kritik erst nach ein paar Tagen echter Nutzung.
