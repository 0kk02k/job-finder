# Umsetzungsplan: Job-Finder — Experience-Verbesserungen

Basierend auf der Kritik-Runde (2026-07-20). Ziel: Aus dem „Backend mit Notfall-UI" ein
Produkt machen, zu dem Nutzer regelmäßig zurückkehren.

**Leitprinzipien für alle Stufen:**

- Minimal-invasive Änderungen, bestehende Patterns (CSS-Variablen-System, `--color-*`) wiederverwenden
- Keine neuen Dependencies, wenn es mit Bordmitteln geht
- Jede Stufe ist eigenständig auslieferbar und lässt die App funktionsfähig
- Nach jeder Stufe: `npx tsc --noEmit` + `npx eslint` auf geänderte Dateien

---

## Stufe 1: Jobs-Liste aufrüsten (Filter, Sortierung, Suche)

**Warum zuerst:** Höchster Nutzen pro Aufwand. Alle Daten liegen bereit, nur Frontend-Arbeit.
Die Liste ist die meistbesuchte Seite bei aktiver Nutzung und aktuell ab ~30 Jobs unbenutzbar.

**Dateien:** `app/jobs/page.tsx`, ggf. `app/api/jobs/route.ts`

**Schritte:**

1. Client-seitige Filter-Toolbar über der Job-Liste in `app/jobs/page.tsx`:
   - Status-Filter: Select/Chips mit den 8 Status (`DISCOVERED` … `ARCHIVED`),
     Default: alles außer `ARCHIVED` und `REJECTED` (Archivierte ausblenden, nicht löschen)
   - Score-Filter: „Nur High Matches (≥7)"
   - Textsuche: Titel + Firma (einfaches `includes`, case-insensitive)
2. Sortierung: Select mit „Neueste zuerst" (Default), „Score absteigend", „Firma A–Z"
3. Ergebnis-Zähler: „12 von 47 Jobs" oberhalb der Liste
4. Empty-State der Filter: „Keine Jobs für diese Filter" + Button „Filter zurücksetzen"
5. Dashboard-Stats korrigieren: `app/page.tsx` zählt aktuell archivierte/abgelehnte Jobs in
   „Jobs gefunden" mit → Filter `ARCHIVED`/`REJECTED` aus der Zählung herausnehmen
6. (Optional, nur wenn Liste spürbar träge) Serverseitige Filterung über Query-Parameter
   in `app/api/jobs/route.ts` (`?status=&minScore=&q=`) — erst bei Bedarf, da clientseitig
   bei realistischen Datenmengen (< 500 Jobs) ausreicht

**Verifizierung:** `tsc`, eslint; manuell: Liste mit >10 Jobs in verschiedenen Status,
Filter-Kombinationen durchklicken, Reload-Verhalten prüfen

---

## Stufe 2: Gespeicherte Suchen + „Neu für dich"

**Warum:** Der Wiederkomm-Hook. Verwandelt Einmal-Tool in täglichen Anlaufpunkt.

**Dateien:** `prisma/schema.prisma` (neues Model), `app/api/search/route.ts`,
`app/search/page.tsx`, `app/page.tsx`, neue Route `app/api/searches/route.ts`

**Schritte:**

1. Schema: neues Model `SavedSearch`:
   ```prisma
   model SavedSearch {
     id        String   @id @default(cuid())
     userId    String
     user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
     query     String
     location  String?
     remote    Boolean  @default(false)
     semantic  Boolean  @default(true)
     lastRunAt DateTime?
     createdAt DateTime @default(now())
     @@unique([userId, query, location])
   }
   ```
   → `npx prisma db push && npx prisma generate`
2. `app/api/searches/route.ts` (neu): GET (Liste), POST (anlegen), DELETE (`[id]`)
3. `app/search/page.tsx`:
   - Button „Suche speichern" nach erfolgreicher Suche (legt SavedSearch mit aktuellen
     Parametern an)
   - Dropdown/Chips-Leiste mit gespeicherten Suchen über dem Formular — Klick füllt
     Formular und startet Suche direkt
4. „Neu für dich": Beim Speichern der Suchergebnisse in `app/api/search/route.ts`
   (beide Upsert-Blöcke) ist bereits erkennbar, ob ein Job neu angelegt wurde
   (Upsert create vs. update). Response um `newJobs: number` erweitern.
5. `app/page.tsx` (Dashboard): Sektion „Deine gespeicherten Suchen" mit je einem
   „Jetzt suchen"-Button (Link zu `/search?saved=<id>`, Suchseite führt sie aus);
   nach dem Lauf Anzeige „N neue Jobs"
6. `lastRunAt` bei jedem Lauf aktualisieren

**Verifizierung:** `tsc`, eslint; manuell: Suche speichern, Dashboard prüfen,
erneut suchen → `newJobs`-Zähler plausibel

---

## Stufe 3: Dashboard als echter Startpunkt

**Warum:** Die Landing Page ist der erste Eindruck bei jedem Login — aktuell nur drei
nackte Zahlen.

**Dateien:** `app/page.tsx`, ggf. `app/api/jobs/route.ts`

**Schritte:**

1. Sektion „Top High Matches": die 3 höchstbewerteten Jobs mit Status
   `HIGH_MATCH`/`SCORED` als kompakte Karten (Titel, Firma, Score-Badge, Link zur
   Detailseite) — Daten kommen aus `/api/jobs`, clientseitig sortiert/gefiltert
2. Sektion „Nächster Schritt": regelbasiert genau EIN Hinweis, z.B.:
   - Kein Resume → „Lade dein Resume hoch, um KI-Matching freizuschalten"
   - High Matches ohne `APPLIED` → „Du hast N High Matches ohne Bewerbung"
   - Alles erledigt → „Starte eine neue Suche"
3. Fehlerbehandlung: Fetch-Fehler zeigt Inline-Hinweis statt stummer „–"-Werte
4. Ladezustand: Skeleton-Platzhalter für die Stat-Karten statt leerer Werte

**Verifizierung:** `tsc`, eslint; manuell: alle drei „Nächster Schritt"-Zustände
durchspielen (frischer Account, mit Matches, alles beworben)

---

## Stufe 4: Toast-System statt `alert()`

**Warum:** Wirkt überall, kleiner Aufwand. `alert()` ist der sichtbarste
„Baustellen"-Indikator der App.

**Dateien:** neue `lib/toast.tsx` (oder `app/components/Toast.tsx`), `app/layout.tsx`,
alle Seiten mit `alert()` (aktuell: `app/jobs/page.tsx`, `app/jobs/[id]/page.tsx`,
`app/resume/page.tsx`, `app/settings/page.tsx`, `app/jobs/new/page.tsx`)

**Schritte:**

1. Minimaler Toast-Context ohne Dependency:
   - `ToastProvider` mit `useToast()`-Hook: `toast.success(msg)`, `toast.error(msg)`
   - Rendert gestapelte Toasts rechts unten, Auto-Dismiss nach 4 s, manuell schließbar
   - Styling im CSS-Variablen-System (`--color-success`, `--color-error`)
2. Provider in `app/layout.tsx` einhängen
3. Alle `alert()`-Aufrufe ersetzen (Erfolg → success-Toast, Fehler → error-Toast)
4. Stumm geschluckte Fehler (`catch {}` mit leerem Block in UI-Fetches) ebenfalls
   mit Toast versehen, wo der Nutzer betroffen ist

**Verifizierung:** `tsc`, eslint; manuell: Fehlerfall provozieren (z.B. Netzwerk aus),
Speicher-Erfolg in Settings prüfen

---

## Stufe 5: Settings reparieren + tote Features ehrlich machen

**Warum:** Vertrauen. Gespeicherte Daten, die nach Reload „weg" aussehen, und
unerreichbare Features zerstören Glaubwürdigkeit.

**Dateien:** `app/settings/page.tsx`, `app/page.tsx`, ggf. Schema/`lib/platforms.ts`

**Schritte:**

1. Profil-Formular prefüllen: beim Laden GET `/api/platforms/profile` aufrufen und
   Felder befüllen (fehlt komplett, obwohl Daten existieren)
2. `minSalary`: Input-Feld (Zahl, optional) in Job-Präferenzen ergänzen — Schema und
   API haben das Feld bereits
3. Provider-Key-Lücke schließen: Key-Feld für Mistral und OpenRouter ergänzen
   (analog zum Gemini-/OpenAI-Feld); Schema-Feld `mistralApiKey`/`openrouterApiKey`
   prüfen bzw. ergänzen → `db push`
4. Landing Page ehrlich machen: Step 4 „Bewerben" umformulieren (z.B. „Exportiere
   angepasste Unterlagen als PDF"), solange Auto-Apply deaktiviert ist
5. Entscheidung Platform-Sync (mit Nutzer klären):
   - Variante A: UI für Credential-Eingabe + Sync-Status in Settings bauen
     (Backend existiert: `/api/platforms/sync`)
   - Variante B: `lib/platforms.ts`-Sync-Code und Route entfernen
   - Empfehlung: B, solange niemand den Sync nutzt — Playwright-Credential-Scraping
     ist wartungsanfällig; manuelles Profil + KI-Optimierung deckt den Nutzen ab

**Verifizierung:** `tsc`, eslint; manuell: Profil speichern → Reload → Felder gefüllt;
Provider-Wechsel mit Key testen

---

## Stufe 6: Styling vereinheitlichen

**Warum:** Zwei visuelle Sprachen (alt: zinc/blau/`dark:`; neu: CSS-Variablen/warm)
wirken wie zwei verschiedene Apps.

**Dateien:** `app/login/page.tsx`, `app/register/page.tsx`, `app/jobs/new/page.tsx`,
`app/jobs/[id]/page.tsx`

**Schritte:**

1. `app/jobs/new/page.tsx`: eigene lokale Mini-Nav entfernen (globale Nav existiert),
   Klassen auf CSS-Variablen-System umstellen
2. `app/login/page.tsx` + `app/register/page.tsx`: auf CSS-Variablen umstellen
   (Struktur und Logik unverändert lassen)
3. `app/jobs/[id]/page.tsx`: auf CSS-Variablen umstellen
4. `dark:`-Klassen-Reste entfernen, sofern kein Dark Mode geplant ist (aktuell wirken
   sie nur auf den alten Seiten und dort inkonsistent)

**Verifizierung:** `tsc`, eslint; manuell: alle fünf Seiten durchklicken, Nav-Verhalten
auf `/jobs/new` prüfen

---

## Stufe 7: Resume-Seite als Hub

**Warum:** Das Resume ist die Basis allen KI-Mehrwerts, die Seite zeigt es aber nur als
Rohtext. PDF-Export existiert, ist aber nur über die Job-Detailseite erreichbar.

**Dateien:** `app/resume/page.tsx`

**Schritte:**

1. Markdown-Rendering der Resume-Ansicht: ohne neue Dependency geht das nur bedingt —
   pragmatisch: Überschriften/Listen minimal selbst rendern ODER bewusst beim
   Pre-Text bleiben und stattdessen Punkt 2 priorisieren (Entscheidung nach Aufwand)
2. PDF-Export auch hier: Button „Resume als PDF" (bestehende `/api/pdf`-Route,
   `type: 'resume'`, ohne `jobId` falls Route das unterstützt — vorher
   `app/api/pdf/route.ts` prüfen und ggf. `jobId` optional machen)
3. Hinweis-Box: wann das Resume zuletzt aktualisiert wurde (`updatedAt` aus API)

**Verifizierung:** `tsc`, eslint; manuell: PDF-Download von `/resume` aus

---

## Bewusst NICHT im Plan (mit Begründung)

- **Auto-Apply fertigbauen** (`lib/autoapply.ts`): Playwright-Formularautomatisierung
  gegen Drittanbieter-Portale ist fragil, rechtlich heikel (AGB der Plattformen) und
  aktuell bewusst 501-deaktiviert. Erst wieder Thema, wenn Stufen 1–7 live sind und
  ein konkreter Nutzerwunsch besteht.
- **Kanban-Board für Jobs**: schön, aber Stufe 1 (Filter) löst 80 % des Schmerzes
  für 20 % des Aufwands. Erst danach neu bewerten.
- **E-Mail-/Push-Benachrichtigungen**: erst sinnvoll, wenn gespeicherte Suchen
  (Stufe 2) regelmäßig laufen — braucht dann einen Scheduler (Cron), der aktuell
  nicht existiert.
- **Pagination serverseitig**: erst bei nachgewiesenem Performance-Problem.

## Abhängigkeiten & empfohlene Reihenfolge

```
Stufe 1 (Liste) ─┐
Stufe 2 (Suchen) ─┼─> Stufe 3 (Dashboard, baut auf 1+2 auf)
Stufe 4 (Toasts) ─┘   (unabhängig, jederzeit einplanbar)
Stufe 5 (Settings)    (unabhängig)
Stufe 6 (Styling)     (unabhängig, gut als letztes vor "Release")
Stufe 7 (Resume)      (unabhängig)
```

Reihenfolge 1 → 2 → 3 → 4 → 5 → 6 → 7 liefert nach jeder Stufe einen sichtbaren
Mehrwert und hält die Risiken klein.
