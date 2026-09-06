# Handoff — Stand 02.09.2026 (Abend)

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
