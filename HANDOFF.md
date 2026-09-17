# Handoff — Stand 02.09.2026 (Abend)

> **Update 14.09.2026:** Fünf Pakete, alle gepusht (Tests: 121 grün). 1) **Präferenz-Gespräch** (`5245b07`): Dead-End „1 von 4" gefixt — Evidence-Filter akzeptiert Fuzzy-Belege (≥80 % Token, `lib/preference-profile.ts`), alle 3 KI-Calls auf `generateTextGuarded`, `POST {finish:true}` + Abschließen-Button (Zwei-Klick, zeigt offene Themen). 2) **Copy-Pass** (`bd4883d`): Füllersätze/Dubletten raus (−23 Zeilen); **Datenschutz-Wahrheit**: „nichts verlässt diese App" war falsch (Lebenslauf-/Anzeigen-/Gesprächstexte gehen an den eigenen KI-Provider) — Startseite + Datenschutzerklärung jetzt präzise, Interviews/Transkripte explizit erwähnt. 3) **Onboarding-Wegweiser** (`47129de`): Zusammenfassungsseiten führen zurück, Onboarding-Schritte 3+4 haben Buttons. **Uncommitted:** Umbenennung zu „Weiter im Onboarding" (beide Interview-Seiten) — wartet auf Freigabe. 4) **Suche 60s** (`5c2f909`): Query-Fächer + Pool-Ranking von Kimi-K3 auf GLM-Flash/Guard, alle 7 Plattform-Fetches mit 15s-Timeout. 5) **50s-Deadline** (`245712c`): Runtime-Log bewies Provider-Stall auch auf Flash (Fan 2×25s) + hängende ungeschützte Scorings → Lauf trägt Gesamtfrist 50s/10s Puffer, Fan 10s ohne Retry, Ranking 30s ohne Retry, Zweitrunde nur mit Restbudget, Scoring mit Guard + max. 8 parallel + Frist-Abbruch (nächtlicher Cron scoriert Reste), BA-Details 20s-Deckel; **Teilergebnisse statt 504**. Neu: „Zu meiner Liste"-Button auf jeder Trefferkarte, `POST /api/jobs` übernimmt vorhandenen Score ohne Neu-Scoring. 6) **Suche-Frist hart gemacht** (uncommitted, Abend): Zweiter Runtime-Log-Beweis — beide Ranking-Chunks (à 60!) starben gleichzeitig am 30s-Guard, der Fall-through fetchte alles doppelt, und kurz vor der Frist gestartete Scorings überstanden sie um ihre vollen 25s+Retry → 60s-Kill, Stream endete ohne Ergebniszeile. Fixes: Ranking-Chunks 60→15 (8 parallel), Kompakt-Vertrag im Ranking-Prompt (Reason max. 1 Satz, max. 3 Skills), `deadline` als 4. Guard-Param kapppt jeden KI-Call an der Gesamtfrist (`attemptTimeoutMs` in `lib/ai.ts`), Fall-through nur noch mit Restbudget (`phaseFitsInBudget`, sonst ehrlicher Fehler statt 504), beide Upsert-Schleifen fristgebunden (Rest steht im Ergebnis, „Zu meiner Liste" adoptiert). Tests: 129 grün (8 neu). **Konto wurde am 13.09. auf Wunsch komplett geleert** (Prod-DB, Login-Zeile blieb; Skript-Pattern: `PrismaNeon`-Adapter nötig, Prisma 7) — Nutzer durchläuft alles frisch; Live-Beweise für Fuzzy-Abhakungen und Deadline-Suche stehen noch aus. **HR-Interview hat dieselben 3 Defekte unverändert** (keine Guards, Substring-Filter inline `lib/interview.ts:237ff`, kein Abschließen-Button; `maxDuration=300` dort). **Beschlossener nächster Schritt:** Zwei-Phasen-Merge der Interviews designen (Phase 1 = Präferenzen mit sofortigem Suchwert, Phase 2 = HR-Teil optional, deduped Agenda, STAR → Anekdoten).

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
