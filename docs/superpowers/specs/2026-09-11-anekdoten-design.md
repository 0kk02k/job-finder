# Anekdoten — der Mensch im Anschreiben

**Datum:** 2026-09-11 · **Status:** von Okko genehmigt (Konzept im Chat, inkl. A1-Entscheidung)

## Der Trick

Ein KI-Anschreiben liest sich wie jedes andere KI-Anschreiben. Was heraussticht: eine
kleine, wahre Anekdote, die genau das beantwortet, was der Arbeitgeber *eigentlich*
sucht — das ungesagte Bedürfnis zwischen den Zeilen, nicht die gelistete Anforderung.

Grundsatz: **Die App kann die Anekdote nur weben, besitzen muss sie der Nutzer.**
Die Fakten kommen von ihm; die KI formt, wählt aus, spitzt zu — erfindet aber nichts.

## Entscheidungen (im Chat getroffen)

| Frage | Entscheidung |
|---|---|
| Herkunft der Annekdoten | KI-Extraktion im **Mini-Interview**, Variante **A1** (geführt, deterministisch — drei Leitfragen, kein Chat-Apparat) |
| Wie ins Anschreiben | **Nutzer wählt vorab** aus einer passenden Auswahl; kein Automatik |
| Ablageort der Sammlung | Sektion **„Anekdoten" auf /resume**, kein neuer Nav-Punkt |
| Auswahl-Kriterium | KI stellt aus der Anzeige **Mutmaßungen über nicht-technische Bedürfnisse** an, jeweils mit **wörtlichem Zitat als Belegstelle**; die Anekdote beantwortet die Mutmaßung |

## Datenmodell

```prisma
model Anecdote {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  title     String
  situation String
  action    String
  result    String
  skills    String   @default("[]") // JSON-Array aus Tags, wie matchDetails beim Job
  source    String   @default("interview") // 'interview' | 'manuell'
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
}
```

`User` bekommt die Rückrelation `anecdotes Anecdote[]`. Migration: neuer Workspace,
`prisma db push` gegen Neon — additive neue Tabelle, bestehende Daten unberührt.

Nichts wird unbestätigt gespeichert: Extraktions-Vorschläge leben als Client-State,
bis der Nutzer eine Karte speichert.

## Extraktion — Mini-Interview A1 (auf /resume)

Panel „Geschichten erzählen" mit **drei Leitfragen-Fenstern**, bewusst so gefasst,
dass sie nicht-technische Qualitäten belegen (Druck, Konflikt, Verantwortung, Lernen):

1. *Ein Erfolg, auf den du stolz bist — und worauf er wirklich zurückgeht.*
2. *Etwas, das schiefging und das du rettest — oder ein Konflikt, den du gelöst hast.*
3. *Eine Aufgabe, die dir niemand zugeteilt hat — wo du ohne Anleitung Verantwortung
   übernommen hast.*

Die freitextlichen Antworten gehen an `POST /api/anecdotes/extract` → **ein** KI-Aufruf
formt Karten-Vorschläge (Titel, STAR-Felder, Skills). Vorschläge erscheinen als
editierbare Karten; speichern geht einzeln (`POST /api/anecdotes`).

Ehrlichkeit: KI-Ausfall beim Extrahieren → ehrlicher Fehler, die Antworten bleiben im
Formular, nichts ist verloren. Sprache der Anekdoten = Sprache der Antworten.

Daneben: „Selbst schreiben" — manuelles Formular mit denselben Feldern (`source: 'manuell'`).

Sammlungs-Ansicht: Karten mit Titel, geraffter Geschichte, Skill-Tags; Bearbeiten und
Löschen (zweistufig, wie überall).

## Auswahl vor dem Erzeugen — das zweistufige Lesen

Klick auf „Anschreiben erzeugen" im Job-Detail. **Ohne** Anekdoten im Bestand:
Generierung wie heute, plus ein Angebot (Link zum Anlegen) — kein Vorwurf.

**Mit** Anekdoten: `POST /api/anecdotes/match { jobId }` — ein KI-Aufruf, der beides liefert:

**a) „Zwischen den Zeilen"** — 2–4 Mutmaßungen über nicht-technische Bedürfnisse,
jede mit wörtlichem Zitat aus der Anzeige als Beleg:

```json
{
  "needs":  [{ "quote": "… Prioritäten in einem schnell wachsenden Umfeld …",
               "need": "Selbstständigkeit ohne Anleitung",
               "why": "Flaches Team, direktes Reporting an die Geschäftsführung" }],
  "matches": [{ "anecdoteId": "…", "reason": "…", "addresses": [0] }]
}
```

Ehrlichkeitsregeln der Fläche:
- Beschriftet als **Mutmaßung** („Was die Anzeige zwischen den Zeilen sucht —
  Vermutung, nicht Gewissheit"), nie als Fakt über den Arbeitgeber. Das Zitat ist
  der sichtbare Beleg, mit dem der Nutzer die Spekulation selbst prüfen kann.
- **`verifyQuotes()`**: jede Zitatstelle wird wörtlich gegen den Anzeigentext geprüft
  (normalisiert: whitespace, Groß-/Kleinschreibung, typografische Anführungszeichen).
  Erfindet die KI ein Zitat, fällt die Mutmaßung weg — beleglose Spekulation wird
  nicht gezeigt.
- KI-Ausfall beim Matchen → keine Sperre: die Sammlung erscheint **unrangiert** zum
  Selbstwählen, klar beschriftet („Rangliste gerade nicht verfügbar").
- `addresses` sind Indizes in `needs`. Fallen alle Mutmaßungen durch die Zitat-
  Verifikation weg, erscheinen die Karten ohne Mutmaßungs-Verweis — die Wahl bleibt.

**b) Radio-Karten** je Anekdote: Titel, Begründungssatz, und *welche Mutmaßung* sie
beantwortet. Beste Vorgabe, „Ohne Anekdote" immer wählbar. Erst der Klick löst die
Generierung aus.

## Prompt-Integration

`buildCoverLetterPrompt` bekommt einen optionalen Anekdoten-Block. Kernregeln:

- Die Anekdote ist **Wahrheitsmaterial** — kürzen, fokussieren, auf den Punkt der
  Anzeige zuspitzen; **nichts erfinden, keine Zahlen ergänzen**.
- Sie **öffnet das Anschreiben** (Einleitung) — genau da, wo der Trick wirkt.
- Sie soll vor allem **die gewählte Mutmaßung belegen**; Zitatkontext wird mitgegeben.

Der Weg zur Generierung: Client sendet `{ jobId, anecdoteId, need }`; `/api/coverletter`
vertraut dem Client nicht — lädt Anekdote (Owner-Check) und Job neu, prüft `need.quote`
erneut gegen den Anzeigentext und deckelt Längen, bevor der Prompt gebaut wird.

Anschreiben bleibt **unpersistiert** (Client-State, wie heute) — der Text gehört dem Nutzer.

## Datenschutz bleibt ehrlich

Die Seite Datenschutz listet auf, was an den KI-Provider geht. Neu ergänzt: Anekdoten-
Texte (bei Extraktion und Anschreiben-Erzeugung), gleiches Prinzip — nur zu diesem
Zweck, an den selbst gewählten Provider.

## Testing (TDD)

- `tests/lib/anecdotes.test.ts` (neu): `verifyQuotes` (exakt, whitespace-, case- und
  typografie-tolerant; erfundene Zitate fallen durch), `sanitizeNeedsPayload`
  (unbelegte weg, Anzahl/Längen deckeln), `sanitizeExtractedProposals` (leere Felder
  weg, Längen deckeln), `anecdoteToPromptBlock`, `buildExtractPrompt` (enthält alle
  drei Leitfragen + Wahrheitsregeln).
- `tests/lib/ai.test.ts` (erweitert): Prompt mit Anekdoten-Block enthält die Anekdote
  wörtlich, die Mutmaßung und die Erfind-Regel; ohne Block unverändertes Verhalten.
- Routes bleiben dünne Vermittlungsschicht — keine Route-Tests (Hausstil).

## Non-Goals

- **A2 (KI-Chat-Interview)** — Session-Apparat lohnt für einen Freundeskreis nicht.
- **Abschöpfen der Interview-`starExamples`** — mögliche spätere Ergänzung, jetzt nicht.
- **Automatische Anekdoten-Wahl** — der Nutzer wählt vorab, bewusst.
- **Anschreiben-Persistenz**, **Needs-Inferenz ohne Anekdoten-Bestand**, jede Art von
  Auto-Bewerbung.
