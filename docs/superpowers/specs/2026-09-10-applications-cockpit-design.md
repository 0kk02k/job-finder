# Design: Bewerbungs-Management-Cockpit

**Datum:** 2026-09-10 · **Status:** vom Nutzer freigegeben (Sektionsdesign im Chat)

## Zweck und Ausgangsproblem

Der Dashboard-Hero versprach „6 High Matches warten auf dich" und führte nur zu
gefundene Jobs — nicht zur eigenen Bewerbungstätigkeit. Es gab keine Fläche, die
laufende Bewerbungen mit Terminen, Notizen und Zeitpunkten zusammen zeigt. Das
Cockpit schließt diese Lücke: **Überblick über das, was man selbst in Bewegung
gesetzt hat.**

Tonalität (aus dem Hero-Umbau gelernt): keine Dringlichkeits-Maschinerie, kein
Vorwurf. Fällige Wiedervorlagen sind ein vorgemerkter eigener Termin, kein
Rückstand.

## Entscheide (mit dem Nutzer geklärt)

| Frage | Entscheidung |
|---|---|
| „Rückruf"-Semantik | **Wiedervorlage-Termin**: der Nutzer setzt pro Bewerbung ein Datum (nachfassen / Gesprächstermin). Fällige stehen oben. Kein Automatismus. |
| Aufenthaltsort | **Neue Seite `/applications`** mit Nav-Punkt „Bewerbungen". Im Hero ersetzt „Bewerbungen im Blick" die High-Matches-Option. |
| Umfang | Liste + Termine + Notizen **+ Wochen-Kennzahlen**. Abgeschlossene Bewerbungen bleiben (vorerst) außen. |
| Architektur | **Eigene schlanke API** (`GET /api/applications`), Schreiben über den erweiterten bestehenden `PATCH /api/jobs/[id]`. Kein RSC-Paradigmenwechsel. |

## Datenmodell

Drei additive, nullable Felder am `Job` (`prisma db push`, produkt-sicher):

- `notes String?` — Klartext, mehrzeilig, gehört dem Nutzer.
- `followUpAt DateTime?` — Wiedervorlage.
- `rejectedAt DateTime?` — Zeitstempel der ersten Absage. Nötig, weil die
  Wochen-Zeile „X Absagen" sonst nur über `updatedAt` gefaked werden könnte
  (Produktprinzip: Ehrlichkeit über Schönreden).

`rejectedAt` folgt der bewährten `appliedAt`-Regel: gesetzt beim Übergang auf
REJECTED, danach nie überschrieben, durch andere Statuswechsel nicht gelöscht —
`rejectedAtFor(nextStatus, current, now)` in `lib/status.ts`, test-first.

Kein Activity-Eintrag für Notiz-Änderungen: Notizen sind ein lebendiges Feld,
kein Ereignis. Das bestehende STATUS_CHANGE-Protokoll bleibt unangetastet.

## API

### GET /api/applications

Antwort: `{ applications: [...], stats: { appliedThisWeek, interviews, offers, rejectedThisWeek } }`

- `applications`: Jobs des Nutzers mit Status APPLIED / INTERVIEW / OFFER;
  schlanke Feldauswahl (id, title, company, location, url, status, score,
  createdAt, appliedAt, followUpAt, notes) — **ohne** `description` und
  `scoreReason` (Payload bleibt leicht, ~10 Zeilen statt 200 Jobs).
- Sortierung (`sortApplications` in `lib/applications.ts`, reine Funktion,
  test-first): fällige Wiedervorlagen zuerst — fällig heißt `followUpAt` vor
  Ende des heutigen Tags, heute zählt also als fällig — aufsteigend nach
  followUpAt; danach „Beworben am" absteigend; ohne Bewerbung nach createdAt
  absteigend.
- `stats`: `appliedThisWeek`/`rejectedThisWeek` aus `appliedAt`/`rejectedAt`
  der letzten 7 Tage (präzise), `interviews`/`offers` als Ist-Zähler der
  Pipeline-Statusse.

### PATCH /api/jobs/[id] — erweitert

Neben `status` optional: `notes` (String oder null = löschen) und
`followUpAt` (ISO-DateTime oder null). Validierung: followUpAt muss
parsebar sein. Bei Statuswechsel nach REJECTED setzt der Server `rejectedAt`
selbst (`rejectedAtFor`) — der Client liefert es nie.

## lib/applications.ts (test-first)

- `PIPELINE_STATUSES = ['APPLIED', 'INTERVIEW', 'OFFER']`
- `sortApplications(apps, today)` — fällig-zuerst-Ordnung, reine Funktion.
- `weekStats(jobs, weekAgo)` — `{ appliedThisWeek, rejectedThisWeek, interviews, offers }`.

## UI

### /applications (Cockpit)

Muster wie die übrigen Seiten: `'use client'`, Fetch, Lade-Skelett, getrennte
Auth-/Fehlerzustände (401 → Login-Hinweis, Netzwerk/Server getrennt benannt).

- Kopf: „Bewerbungen" + eine Belegzeile „Diese Woche: 4 beworben · 2 im
  Gespräch · 1 Angebot · 1 Absage" — **Textzeile mit `tabular-nums`, kein
  Kennzahlen-Kartengrid** (Stats-Deko-Anti-Pattern bleibt draußen).
- Zeile je Bewerbung: Titel (Link zum Job) · Firma · Ort · StatusBadge ·
  Score (falls vorhanden, `scoreTone`).
- Zeitstempel sichtbar: **„Gefunden am 12.08. · Beworben am 14.08."** —
  absolute Kurzdaten (de-DE, Tag/Monat, `tabular-nums`).
- **Wiedervorlage:** `<input type="date">`, Änderung speichert sofort via
  PATCH; Leerung setzt null. `followUpAt ≤ heute` → dezentes Khaki-„Fällig"-
  Etikett (Honest-Signal-Tint, kein Alarm) und Platz oben in der Ordnung.
- **Notiz:** mehrzeilige Textarea direkt in der Zeile, speichert beim
  Verlassen des Feldes; Fehler → Toast, Text bleibt stehen.
- Leere Fläche: „Noch nichts beworben" + Ausweg „Top Matches ansehen"
  (`/jobs?filter=high_match`).

### Job-Detail

Derselbe Schreibweg: Notiz- und Wiedervorlage-Karte (Textarea + Date-Input,
save on blur) — die Detailseite bleibt das Zuhause des einzelnen Jobs.

### Dashboard-Hero (Launcher)

Die Option „High Matches ansehen" wird ersetzt durch:

> **Bewerbungen im Blick** — „X laufende Bewerbungen — Termine, Notizen,
> Wiedervorlage." · sichtbar ab `stats.applied > 0` · Ziel `/applications`

High Matches bleiben als Inhalt erhalten (Top-Matches-Sektion unten,
Jobs-Filter) — sie versprechen nur nicht mehr den falschen Einstieg.

### Navigation

`links` um `{ href: '/applications', label: 'Bewerbungen' }` ergänzen
(nach „Jobs").

## Fehlerbehandlung

- 401 auf /applications → Login-Hinweis (Muster der Jobs-Seite).
- Netzwerk vs. Server getrennt benannt (Muster des Dashboards).
- PATCH-Fehler (Notiz/Wiedervorlage) → Toast mit Grund, lokaler State bleibt.

## Tests und Verifikation

- TDD: `rejectedAtFor` (erweitert tests/lib/status.test.ts),
  `sortApplications` + `weekStats` (tests/lib/applications.test.ts).
- Routen bleiben dünne Kleber nach Projektmuster (wie bestehende Routen
  ungetestet); UI-Verifikation via Lint (nur Altlasten zählen), Build,
  Impeccable-Detector über neue/geänderte UI-Dateien.
- Ausrollen: `prisma db push` auf Neon (additive Felder); schlägt die
  Sandbox-Verbindung fehl, Befehl dem Nutzer per `!` übergeben.
