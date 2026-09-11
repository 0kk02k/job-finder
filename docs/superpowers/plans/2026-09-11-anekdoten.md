# Anekdoten Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wahre Anekdoten sammeln (Mini-Interview A1), aus der Anzeige nicht-technische Bedürfnisse mit verifizierten Zitatstellen mutmaßen, und die vom Nutzer vorab gewählte Anekdote als Aufhänger ins KI-Anschreiben weben.

**Architecture:** Reine Logik in `lib/anecdotes.ts` (TDD), KI-Aufrufe als dünne Wrapper in `lib/ai.ts` (Hausstil: Prompt-Builder + generate-Funktion), Endpoints unter `/api/anecdotes*`, Erweiterung von `/api/coverletter`. UI: Sektion auf `/resume`, Chooser-State im Anschreiben-Block des Job-Details. Anschreiben bleibt unpersistiert.

**Tech Stack:** Next.js 16 App Router, Prisma 7 + Neon Postgres, next-auth v5 beta, Vercel AI SDK (`generateText`), node:test + tsx.

**Spec:** `docs/superpowers/specs/2026-09-11-anekdoten-design.md` — der Plan argumentiert aus der Spec; Executoren lesen beides.

## Global Constraints

- AGENTS.md-Pflicht: Vor Route-/Seiten-Arbeit die relevanten Guides in `node_modules/next/dist/docs/` lesen. Dynamische Routen: `{ params }: { params: Promise<{ id: string }> }` + `await params` (Next 16).
- Alle nutzersichtbaren Texte auf Deutsch, sachlich-warm. Fehler ehrlich benannt — kein stiller Fallback, keine `alert()`s (Toast-System: `app/components/Toast`).
- Tests: nur `lib/` (Hausstil). `npm test` = `node --import tsx --test "tests/**/*.test.ts"`. TDD: erst den roten Test beobachten, dann implementieren.
- Design: Tailwind-Utilities auf die `@theme`-Tokens (`bg-accent`, `text-selection`, `bg-border-soft`), keine `dark:`-Klassen, keine Vollflächen für Bedeutung. Nach jeder UI-Änderung: `node /home/okko/.claude/skills/impeccable/scripts/detect.mjs --json <geänderte Dateien>` — muss `[]` liefern.
- Lint-Altlasten: 7 `no-explicit-any`-Fehler in `lib/apify.ts` + `lib/platforms.ts` sind bekannt und außerhalb des Scopes — nicht anfassen, aber auch keine neuen einführen. `npm run lint` darf am Ende nicht mehr Fehler zeigen als vorher.
- Niemals `Lebenslauf.docx` committen (persönliches Dokument des Nutzers, liegt untracked im Repo-Root).
- Migrationen: `npx prisma db push` direkt gegen die Neon-Prod-DB (aus `.env`) — neue Tabelle ist additiv und sicher. Kein `migrate dev`.
- Commit-Stil: englische imperative Einzeiler (wie die Historie), Footer `Co-Authored-By: Claude <noreply@anthropic.com>`.

## File Structure

| Datei | Neu/Änderung | Verantwortung |
|---|---|---|
| `prisma/schema.prisma` | ändern | `Anecdote`-Modell + `User`-Relation |
| `lib/anecdotes.ts` | neu | reine Logik: Fragen, Prompt-Builder, Sanitizer, `verifyQuotes` |
| `lib/ai.ts` | ändern | `buildCoverLetterPrompt`-Block, Wrapper `generateAnecdoteProposals` / `matchAnecdotesForAd` |
| `app/api/anecdotes/route.ts` | neu | GET Liste, POST anlegen |
| `app/api/anecdotes/[id]/route.ts` | neu | PATCH, DELETE (Owner-Check) |
| `app/api/anecdotes/extract/route.ts` | neu | POST: Antworten → Karten-Vorschläge (nichts persistiert) |
| `app/api/anecdotes/match/route.ts` | neu | POST: Anzeige → Mutmaßungen mit Zitaten + Rangliste |
| `app/api/coverletter/route.ts` | ändern | optional `anecdoteId` + `need`, serverseitig re-verifiziert |
| `app/resume/page.tsx` | ändern | Sektion „Anekdoten": Liste, Formular, Extract-Panel |
| `app/jobs/[id]/page.tsx` | ändern | Chooser vor dem „Anschreiben erzeugen" |
| `app/datenschutz/page.tsx` | ändern | ein Satz: Anekdoten-Texte an den KI-Provider |
| `tests/lib/anecdotes.test.ts` | neu | TDD für alle reinen Funktionen |
| `tests/lib/ai.test.ts` | ändern | Anschlag für den Anekdoten-Block |

### Task 1: Schema — `Anecdote`-Modell

**Files:**
- Modify: `prisma/schema.prisma` (User-Relation: Zeile 28; neues Model nach `SavedSearch`, vor `InterviewSession`)

**Interfaces:**
- Produces: `prisma.anecdote` mit Feldern `id, userId, title, situation, action, result, skills (JSON-String), source ('interview'|'manuell'), createdAt, updatedAt`

- [ ] **Step 1: Relation am `User` ergänzen**

Im Modell `User` (Zeilen 14–29) nach `interviews  InterviewSession[]` ergänzen:

```prisma
  anecdotes   Anecdote[]
```

- [ ] **Step 2: Modell ergänzen**

Nach dem `SavedSearch`-Modell (nach Zeile 191) einfügen:

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

- [ ] **Step 3: Gegen Neon-Prod pushen und Client generieren**

Run: `npx prisma db push`
Expected: „Your database is now in sync" (additive neue Tabelle; bestehende Daten unberührt). Prisma generiert den Client automatisch mit.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine neuen Fehler.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "Anecdote model: stories as first-class data

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 2: `verifyQuotes` — Zitate brauchen wörtliche Belege

**Files:**
- Create: `lib/anecdotes.ts`
- Test: `tests/lib/anecdotes.test.ts`

**Interfaces:**
- Produces: `verifyQuotes(quote: string, adText: string): boolean` — true nur, wenn `quote` nach Normalisierung (whitespace, Groß-/Kleinschreibung, typografische Anführungszeichen) wörtlich in `adText` steht. Außerdem intern: `normalizeText(s: string): string` (nicht exportiert).

- [ ] **Step 1: Rote Tests schreiben**

`tests/lib/anecdotes.test.ts` neu anlegen:

```ts
// Die Mutmaßungen über „zwischen den Zeilen" leben und sterben mit ihren
// Zitatstellen: erfindet die KI ein Zitat, fällt die Mutmaßung weg. Getestet
// wird der Normalisierungs-Vertrag — die KI selbst ist außen vor (lokal kein Key).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verifyQuotes } from '../../lib/anecdotes'

test('verifyQuotes accepts verbatim quotes despite case, line breaks, and quote glyphs', () => {
  const ad = 'Wir suchen jemanden, der Prioritäten in einem schnell wachsenden\n  Umfeld setzt.'
  assert.equal(verifyQuotes('Prioritäten in einem schnell wachsenden Umfeld setzt', ad), true)
  assert.equal(verifyQuotes('„Prioritäten in einem schnell wachsenden Umfeld setzt“', ad), true)
  assert.equal(verifyQuotes('PRIORITÄTEN IN EINEM SCHNELL WACHSENDEN', ad), true)
})

test('verifyQuotes rejects invented quotes and empty input', () => {
  const ad = 'Wir suchen jemanden mit Erfahrung in der Lagerlogistik.'
  assert.equal(verifyQuotes('Wir zahlen Bestgehälter', ad), false)
  assert.equal(verifyQuotes('', ad), false)
  assert.equal(verifyQuotes('Lagerlogistik', ''), false)
})
```

- [ ] **Step 2: Rot beobachten**

Run: `npm test 2>&1 | tail -8`
Expected: 1 fail — `verifyQuotes` existiert nicht (Import-/Referenzfehler), alle anderen Tests weiter grün.

- [ ] **Step 3: Minimal implementieren**

`lib/anecdotes.ts` neu anlegen:

```ts
// Anekdoten: reine Logik für Mini-Interview, Mutmaßungen mit Zitat-Verifikation
// und den Anekdoten-Block im Anschreiben-Prompt. Bewusst ohne I/O — alles hier
// ist unit-testbar, die Routes bleiben dünne Vermittlungsschicht.

// Normalisierung für die Zitat-Prüfung: Zeilenumbrüche der Anzeige, Groß-/-
// Kleinschreibung und Anführungszeichen dürfen nicht täuschen. Anführungs-
// zeichen werden auf BEIDEN Seiten entfernt — ein Zitat mit „Gänsefüßchen“ um
// die Kernphrase und der blanke Anzeigentext fallen auf dasselbe heraus.
function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[„“”‟«»‚‛‹›‘’"''´`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Ein Zitat ohne wörtlichen Beleg im Anzeigentext ist eine unbelegte
// Spekulation — und die wird nicht gezeigt (Spec: Ehrlichkeitsregel).
export function verifyQuotes(quote: string, adText: string): boolean {
  if (!quote || !adText) return false
  return normalizeText(adText).includes(normalizeText(quote))
}
```

- [ ] **Step 4: Grün beobachten**

Run: `npm test 2>&1 | tail -8`
Expected: alle Tests pass, Ausgabe ohne Fehler.

- [ ] **Step 5: Commit**

```bash
git add lib/anecdotes.ts tests/lib/anecdotes.test.ts
git commit -m "Quote verification: guesses need verbatim evidence

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 3: JSON- und Skills-Helfer

**Files:**
- Modify: `lib/anecdotes.ts`, `tests/lib/anecdotes.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `parseJsonLoose(text: string): unknown` — zieht JSON aus KI-Antworten (mit/ohne Code-Fences, mit Beiwerk), wirft, wenn nichts parsebares da ist.
  - `parseSkills(json: string): string[]` — liest den gespeicherten JSON-String, `[]` bei Müll.
  - `sanitizeSkillsInput(raw: unknown): string[]` — Client-Eingabe → saubere Tag-Liste (getrimmt, max 8 à 40 Zeichen).

- [ ] **Step 1: Rote Tests ergänzen**

In `tests/lib/anecdotes.test.ts` den Import erweitern und die Tests anhängen:

```ts
import { parseJsonLoose, parseSkills, sanitizeSkillsInput, verifyQuotes } from '../../lib/anecdotes'

test('parseJsonLoose unwraps fenced and accompanied JSON', () => {
  assert.deepEqual(parseJsonLoose('```json\n[{"a":1}]\n```'), [{ a: 1 }])
  assert.deepEqual(parseJsonLoose('Hier sind deine Karten:\n[{"a":2}] — viel Erfolg!'), [{ a: 2 }])
  assert.deepEqual(parseJsonLoose('{"needs":[]}'), { needs: [] })
  assert.throws(() => parseJsonLoose('kein JSON hier'))
})

test('parseSkills reads the stored JSON and survives garbage', () => {
  assert.deepEqual(parseSkills('["a","b"]'), ['a', 'b'])
  assert.deepEqual(parseSkills('nix'), [])
  assert.deepEqual(parseSkills('{"x":1}'), [])
})

test('sanitizeSkillsInput trims, drops non-strings, caps count and length', () => {
  assert.deepEqual(sanitizeSkillsInput([' a ', 'b', 42, '']), ['a', 'b'])
  assert.equal(sanitizeSkillsInput(Array.from({ length: 12 }, (_, i) => `skill${i}`)).length, 8)
  assert.deepEqual(sanitizeSkillsInput('kein array'), [])
})
```

- [ ] **Step 2: Rot beobachten**

Run: `npm test 2>&1 | tail -8`
Expected: 3 fail (die drei neuen), Rest grün.

- [ ] **Step 3: Minimal implementieren**

In `lib/anecdotes.ts` ergänzen:

```ts
// KI-Antworten kommen gepolstert („Hier ist dein JSON:", Code-Fences, Nachsatz).
// Wir schneiden bis auf den Kern zurück — oder werfen ehrlich.
export function parseJsonLoose(text: string): unknown {
  const stripped = text.replace(/```(?:json)?/gi, '')
  const start = stripped.search(/[{[]/)
  if (start === -1) throw new Error('Kein JSON in der KI-Antwort')
  const end = Math.max(stripped.lastIndexOf('}'), stripped.lastIndexOf(']'))
  if (end <= start) throw new Error('Kein abgeschlossenes JSON in der KI-Antwort')
  return JSON.parse(stripped.slice(start, end + 1))
}

// Gespeicherte Skills sind ein JSON-String (wie matchDetails beim Job) —
// Müll wird zu einer leeren Liste, nie zu einem Crash.
export function parseSkills(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json)
    return sanitizeSkillsInput(parsed)
  } catch {
    return []
  }
}

const MAX_SKILLS = 8
const MAX_SKILL_LEN = 40

// Client-Eingabe (Extract-Karte, Formular): getrimmt, nur Strings, gedeckelt.
export function sanitizeSkillsInput(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.trim().slice(0, MAX_SKILL_LEN))
    .filter(Boolean)
    .slice(0, MAX_SKILLS)
}
```

- [ ] **Step 4: Grün beobachten**

Run: `npm test 2>&1 | tail -8`
Expected: alle pass.

- [ ] **Step 5: Commit**

```bash
git add lib/anecdotes.ts tests/lib/anecdotes.test.ts
git commit -m "Loose JSON parsing and skill-tag sanitizing

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 4: Extraktion — Leitfragen, Extrakt-Prompt, Vorschlags-Bereinigung

**Files:**
- Modify: `lib/anecdotes.ts`, `tests/lib/anecdotes.test.ts`

**Interfaces:**
- Produces:
  - `EXTRACT_QUESTIONS: readonly string[]` — die drei Leitfragen (Fläche und Prompt nutzen dieselben Strings).
  - `buildExtractPrompt(answers: string[]): string` — formt aus den drei Freitext-Antworten den Extraktions-Prompt (JSON-Vertrag, Wahrheitsregeln).
  - `sanitizeExtractedProposals(raw: unknown): AnecdoteInput[]` — KI-Rohling → Karten-Vorschläge; leere Geschichten fallen weg, Längen gedeckelt.
  - `interface AnecdoteInput { title: string; situation: string; action: string; result: string; skills: string[] }`

- [ ] **Step 1: Rote Tests ergänzen**

```ts
import {
  EXTRACT_QUESTIONS,
  buildExtractPrompt,
  sanitizeExtractedProposals,
} from '../../lib/anecdotes'

test('sanitizeExtractedProposals keeps complete stories, drops empties, caps sizes', () => {
  const raw = [
    {
      title: 'Deploy-Freitag',
      situation: 'Ausfall um 17 Uhr',
      action: 'Rollback entschieden und kommuniziert',
      result: 'Keine Ausfälle im Weihnachtsgeschäft',
      skills: ['Druck', 'Entscheidung'],
    },
    { title: 'Leere Karte', situation: '', action: '', result: '', skills: [] },
    { title: 'X'.repeat(500), situation: 's', action: 'a', result: 'r', skills: [] },
  ]
  const clean = sanitizeExtractedProposals(raw)
  assert.equal(clean.length, 2)
  assert.equal(clean[0].title, 'Deploy-Freitag')
  assert.ok(clean[1].title.length <= 120)
  clean.forEach((p) => {
    assert.equal(typeof p.title, 'string')
    assert.equal(typeof p.situation, 'string')
    assert.equal(typeof p.action, 'string')
    assert.equal(typeof p.result, 'string')
    assert.ok(Array.isArray(p.skills))
  })
})

test('sanitizeExtractedProposals survives non-array input', () => {
  assert.deepEqual(sanitizeExtractedProposals(undefined), [])
  assert.deepEqual(sanitizeExtractedProposals('nope'), [])
  assert.deepEqual(sanitizeExtractedProposals([{ title: 't' }]), [])
})

test('buildExtractPrompt carries all three questions, the answers and the truth rules', () => {
  const prompt = buildExtractPrompt(['Ich habe 2019 das Team geleitet.', 'Ein Kunde drohte zu kündigen.', 'Niemand wollte die Migration.'])
  EXTRACT_QUESTIONS.forEach((q) => assert.ok(prompt.includes(q), `Frage fehlt: ${q}`))
  assert.match(prompt, /2019/)
  assert.match(prompt, /erfinde|nichts dazu/i)
  assert.match(prompt, /JSON/)
})
```

- [ ] **Step 2: Rot beobachten**

Run: `npm test 2>&1 | tail -8`
Expected: 3 fail, Rest grün.

- [ ] **Step 3: Minimal implementieren**

```ts
export interface AnecdoteInput {
  title: string
  situation: string
  action: string
  result: string
  skills: string[]
}

// Die drei Leitfragen des Mini-Interviews (A1) — bewusst so gefasst, dass sie
// nicht-technische Qualitäten belegen: Druck, Konflikt, Verantwortung, Lernen.
// Die Fläche rendert dieselben Strings wie der Prompt.
export const EXTRACT_QUESTIONS: readonly string[] = [
  'Ein Erfolg, auf den du stolz bist — und worauf er wirklich zurückgeht.',
  'Etwas, das schiefging und das du rettest — oder ein Konflikt, den du gelöst hast.',
  'Eine Aufgabe, die dir niemand zugeteilt hat — wo du ohne Anleitung Verantwortung übernommen hast.',
]

const MAX_PROPOSALS = 5
const MAX_TITLE = 120
const MAX_STORY = 1200

function cappedString(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

// Was die KI vorschlägt, bleibt Vorschlag: unvollständige Geschichten fallen
// weg, nichts wird länger als vereinbart. Speichern tut erst der Nutzer.
export function sanitizeExtractedProposals(raw: unknown): AnecdoteInput[] {
  if (!Array.isArray(raw)) return []
  const proposals: AnecdoteInput[] = []
  for (const item of raw.slice(0, MAX_PROPOSALS)) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    const proposal: AnecdoteInput = {
      title: cappedString(record.title, MAX_TITLE),
      situation: cappedString(record.situation, MAX_STORY),
      action: cappedString(record.action, MAX_STORY),
      result: cappedString(record.result, MAX_STORY),
      skills: sanitizeSkillsInput(record.skills),
    }
    // Titel allein ist keine Geschichte — wenigstens ein Stern-Feld muss stehen.
    if (!proposal.situation && !proposal.action && !proposal.result) continue
    proposals.push(proposal)
  }
  return proposals
}

export function buildExtractPrompt(answers: string[]): string {
  const told = answers
    .map((answer, i) => `${i + 1}. ${EXTRACT_QUESTIONS[i] ?? 'Weitere Geschichte:'}\n${answer}`)
    .join('\n\n')
  return `Der Nutzer hat über seine beruflichen Erfahrungen erzählt. Forme daraus
bis zu 5 wahre Anekdoten als JSON-Array. Jede Anekdote:

{
  "title": "kurzer prägnanter Titel",
  "situation": "Anlass und Umfeld",
  "action": "was der Nutzer konkret getan hat",
  "result": "was herauskam",
  "skills": ["2-4 nicht-technische Qualitäten, die die Geschichte belegt"]
}

Wahrheitsregeln: Forme nur, was der Nutzer erzählt hat — erfinde nichts dazu,
ergänze keine Zahlen, keine Firmen, keine Details. Kürze auf das Wesentliche,
sprich die Geschichte so, wie der Nutzer sie erzählt hat (Sprache der Antworten).

Erzählte Geschichten:

${told}

Gib AUSSCHLIESSLICH das JSON-Array aus — kein Vorwort, keine Anmerkungen.`
}
```

- [ ] **Step 4: Grün beobachten**

Run: `npm test 2>&1 | tail -8`
Expected: alle pass.

- [ ] **Step 5: Commit**

```bash
git add lib/anecdotes.ts tests/lib/anecdotes.test.ts
git commit -m "Story extraction: guided questions, prompt, proposal sanitizing

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 5: Mutmaßungen — Needs mit Zitat-Pflicht, Ranglisten-Bereinigung

**Files:**
- Modify: `lib/anecdotes.ts`, `tests/lib/anecdotes.test.ts`

**Interfaces:**
- Consumes: `verifyQuotes` (Task 2), `normalizeText` (intern)
- Produces:
  - `interface NeedGuess { quote: string; need: string; why: string }`
  - `interface AnecdoteMatch { anecdoteId: string; reason: string; addresses: number[] }`
  - `sanitizeNeeds(raw: unknown, adText: string): NeedGuess[]` — max 4, Quote muss `verifyQuotes` bestehen.
  - `sanitizeMatches(raw: unknown, anecdoteIds: readonly string[], needCount: number): AnecdoteMatch[]` — max 3, nur bekannte IDs, `addresses` nur Indizes `< needCount`, dedupliziert.
  - `sanitizeNeedPayload(raw: unknown, adText: string): NeedGuess | null` — ein Need vom Client, serverseitig geprüft (dem Client wird nicht vertraut); `null`, wenn unbelegbar.
  - `buildMatchPrompt(adDescription: string, anecdotes: Array<{ id: string } & AnecdoteInput>): string`

- [ ] **Step 1: Rote Tests ergänzen**

```ts
import {
  buildMatchPrompt,
  sanitizeMatches,
  sanitizeNeedPayload,
  sanitizeNeeds,
} from '../../lib/anecdotes'

const AD =
  'Wir suchen jemanden, der Prioritäten in einem schnell wachsenden Umfeld setzt. Teamplayer gesucht.'

test('sanitizeNeeds keeps only quotes the ad actually contains', () => {
  const raw = [
    { quote: 'Prioritäten in einem schnell wachsenden Umfeld setzt', need: 'Selbstständigkeit', why: 'Wachstum genannt' },
    { quote: 'Wir bezahlen Bestgehälter', need: 'erfunden', why: 'steht nicht drin' },
  ]
  const needs = sanitizeNeeds(raw, AD)
  assert.equal(needs.length, 1)
  assert.equal(needs[0].need, 'Selbstständigkeit')
})

test('sanitizeNeeds caps at four guesses', () => {
  const raw = Array.from({ length: 6 }, (_, i) => ({
    quote: 'Teamplayer gesucht',
    need: `Bedürfnis ${i}`,
    why: 'weil',
  }))
  assert.equal(sanitizeNeeds(raw, AD).length, 4)
})

test('sanitizeMatches drops unknown anecdote ids and out-of-range addresses', () => {
  const raw = [
    { anecdoteId: 'a1', reason: 'passt zur Wachstums-Mutmaßung', addresses: [0, 9, 0] },
    { anecdoteId: 'fremd', reason: 'x', addresses: [0] },
    { anecdoteId: 'a2', reason: 'y'.repeat(400), addresses: [] },
  ]
  const matches = sanitizeMatches(raw, ['a1', 'a2'], 1)
  assert.deepEqual(matches.map((m) => m.anecdoteId), ['a1', 'a2'])
  assert.deepEqual(matches[0].addresses, [0])
  assert.ok(matches[1].reason.length <= 300)
})

test('sanitizeNeedPayload returns the guess only when the quote is verbatim', () => {
  const good = { quote: 'Teamplayer gesucht', need: 'Teamfähigkeit', why: 'ausdrücklich gefordert' }
  assert.deepEqual(sanitizeNeedPayload(good, AD), good)
  assert.equal(sanitizeNeedPayload({ quote: 'erfunden', need: 'x', why: 'y' }, AD), null)
  assert.equal(sanitizeNeedPayload(null, AD), null)
  assert.equal(sanitizeNeedPayload('kein objekt', AD), null)
})

test('buildMatchPrompt demands verbatim quotes and ranks the given anecdotes', () => {
  const prompt = buildMatchPrompt(AD, [
    { id: 'a1', title: 'Deploy-Freitag', situation: 's', action: 'a', result: 'r', skills: ['Druck'] },
  ])
  assert.match(prompt, /wörtlich/i)
  assert.match(prompt, /Mutmaßung/i)
  assert.match(prompt, /a1/)
  assert.match(prompt, /JSON/)
})
```

- [ ] **Step 2: Rot beobachten**

Run: `npm test 2>&1 | tail -8`
Expected: 5 fail, Rest grün.

- [ ] **Step 3: Minimal implementieren**

```ts
export interface NeedGuess {
  quote: string
  need: string
  why: string
}

export interface AnecdoteMatch {
  anecdoteId: string
  reason: string
  addresses: number[]
}

const MAX_NEEDS = 4
const MAX_QUOTE = 300
const MAX_NEED = 200
const MAX_WHY = 400
const MAX_MATCHES = 3
const MAX_REASON = 300

// Nur belegte Mutmaßungen überleben: ein Bedürfnis ohne wörtliche Zitatstelle
// in der Anzeige wird nicht gezeigt (Spec: „beleglose Spekulation wird nicht
// gezeigt").
export function sanitizeNeeds(raw: unknown, adText: string): NeedGuess[] {
  if (!Array.isArray(raw)) return []
  const needs: NeedGuess[] = []
  for (const item of raw.slice(0, MAX_NEEDS * 2)) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    const quote = cappedString(record.quote, MAX_QUOTE)
    const need = cappedString(record.need, MAX_NEED)
    const why = cappedString(record.why, MAX_WHY)
    if (!need || !verifyQuotes(quote, adText)) continue
    needs.push({ quote, need, why })
    if (needs.length >= MAX_NEEDS) break
  }
  return needs
}

export function sanitizeMatches(
  raw: unknown,
  anecdoteIds: readonly string[],
  needCount: number
): AnecdoteMatch[] {
  if (!Array.isArray(raw)) return []
  const known = new Set(anecdoteIds)
  const matches: AnecdoteMatch[] = []
  for (const item of raw.slice(0, MAX_MATCHES * 2)) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    const anecdoteId = typeof record.anecdoteId === 'string' ? record.anecdoteId : ''
    if (!known.has(anecdoteId)) continue
    const addresses = Array.isArray(record.addresses)
      ? [...new Set(record.addresses)]
          .filter((i): i is number => typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < needCount)
          .slice(0, 3)
      : []
    matches.push({ anecdoteId, reason: cappedString(record.reason, MAX_REASON), addresses })
    if (matches.length >= MAX_MATCHES) break
  }
  return matches
}

// Der Need kommt vom Client zurück (aus der Chooser-Auswahl) — dem wird nicht
// vertraut: Form geprüft, Zitat erneut gegen die Anzeige verifiziert, Längen
// gedeckelt. `null` heißt: Anekdote ja, Mutmaßung unbelegbar → weglassen.
export function sanitizeNeedPayload(raw: unknown, adText: string): NeedGuess | null {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  const quote = cappedString(record.quote, MAX_QUOTE)
  const need = cappedString(record.need, MAX_NEED)
  if (!need || !verifyQuotes(quote, adText)) return null
  return { quote, need, why: cappedString(record.why, MAX_WHY) }
}

export function buildMatchPrompt(
  adDescription: string,
  anecdotes: Array<{ id: string } & AnecdoteInput>
): string {
  const list = anecdotes
    .map(
      (a) =>
        `id: ${a.id}\nTitel: ${a.title}\nSituation: ${a.situation}\nGetan: ${a.action}\nErgebnis: ${a.result}\nQualitäten: ${a.skills.join(', ')}`
    )
    .join('\n\n')
  return `Lies diese Stellenanzeige und stelle Mutmaßungen an: Welche NICHT-technischen
Bedürfnisse hat der Arbeitgeber zwischen den Zeilen? (z. B. Selbstständigkeit,
Druckresistenz, Konfliktfähigkeit, Lernbereitschaft, Loyalität)

Stellenanzeige:
${adDescription}

Anekdoten des Nutzers (wahre Geschichten):

${list}

Liefere JSON:

{
  "needs": [
    { "quote": "WÖRTLICHES Zitat aus der Anzeige als Beleg — kopiere den Text Zeichen für Zeichen",
      "need": "das vermutete nicht-technische Bedürfnis",
      "why": "ein Satz: woran du es erkennst" }
  ],
  "matches": [
    { "anecdoteId": "id der passendsten Anekdote",
      "reason": "ein Satz: warum diese Geschichte dieses Bedürfnis belegt",
      "addresses": [Indizes der needs, die die Anekdote beantwortet] }
  ]
}

Regeln: 2-4 Mutmaßungen, jede mit wörtlichem Zitat aus der Anzeige — erfinde
keine Zitate. Rangiere höchstens 3 Anekdote-IDs, die besten zuerst. Gib
AUSSCHLIESSLICH das JSON aus.`
}
```

- [ ] **Step 4: Grün beobachten**

Run: `npm test 2>&1 | tail -8`
Expected: alle pass.

- [ ] **Step 5: Commit**

```bash
git add lib/anecdotes.ts tests/lib/anecdotes.test.ts
git commit -m "Need guesses with verbatim-quote duty, match sanitizing

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 6: `anecdoteToPromptBlock` — der Wahrheitsblock

**Files:**
- Modify: `lib/anecdotes.ts`, `tests/lib/anecdotes.test.ts`

**Interfaces:**
- Consumes: `AnecdoteInput`, `NeedGuess`
- Produces: `anecdoteToPromptBlock(anecdote: AnecdoteInput, need: NeedGuess | null): string` — der Block, der in den Anschreiben-Prompt eingesetzt wird. Enthält die Anekdote wörtlich, die Erfind-Regel, den Öffnungs-Auftrag und — wenn vorhanden — die Mutmaßung samt Zitat.

- [ ] **Step 1: Rote Tests ergänzen**

```ts
import { anecdoteToPromptBlock } from '../../lib/anecdotes'

const ANECDOTE = {
  title: 'Deploy-Freitag',
  situation: 'Ausfall um 17 Uhr',
  action: 'Rollback entschieden und kommuniziert',
  result: 'Keine Ausfälle im Weihnachtsgeschäft',
  skills: ['Druck'],
}

test('prompt block carries the anecdote verbatim, the no-invention rule and the need', () => {
  const block = anecdoteToPromptBlock(ANECDOTE, {
    quote: 'Teamplayer gesucht',
    need: 'Teamfähigkeit',
    why: 'klar gefordert',
  })
  assert.match(block, /Deploy-Freitag/)
  assert.match(block, /Rollback/)
  assert.match(block, /erfinde|nichts dazu/i)
  assert.match(block, /Teamfähigkeit/)
  assert.match(block, /Teamplayer gesucht/)
})

test('prompt block works without a need guess', () => {
  const block = anecdoteToPromptBlock(ANECDOTE, null)
  assert.match(block, /Deploy-Freitag/)
  assert.ok(!block.includes('Mutmaßung'))
})

test('prompt block orders the anecdote as the letter’s opening', () => {
  const block = anecdoteToPromptBlock(ANECDOTE, null)
  assert.match(block, /Einleitung|öffnet|Aufhänger/i)
})
```

- [ ] **Step 2: Rot beobachten**

Run: `npm test 2>&1 | tail -8`
Expected: 3 fail, Rest grün.

- [ ] **Step 3: Minimal implementieren**

```ts
// Der Block im Anschreiben-Prompt: die Anekdote ist Wahrheitsmaterial — die KI
// darf kürzen und auf die Stelle zuspitzen, aber nichts erfinden. Und sie ist
// der Aufhänger: Einleitung heißt Anekdote, nicht Motivationsformel.
export function anecdoteToPromptBlock(anecdote: AnecdoteInput, need: NeedGuess | null): string {
  const needBlock = need
    ? `
Mutmaßung, die die Anekdote belegen soll: ${need.need}
Belegstelle aus der Anzeige: „${need.quote}"${need.why ? `\nWarum: ${need.why}` : ''}`
    : ''
  return `WAHRE ANEKDOTE DES NUTZERS — Wahrheitsmaterial: kürzen, fokussieren, auf
die Stelle zuspitzen. Erfinde nichts dazu und ergänze keine Zahlen.

Titel: ${anecdote.title}
Situation: ${anecdote.situation}
Was ich getan habe: ${anecdote.action}
Ergebnis: ${anecdote.result}${needBlock}

Das Anschreiben ÖFFNET mit dieser Anekdote: Sie ist die Einleitung (Strukturpunkt 1)
— kein generischer Motivationssatz. Der Rest der Struktur bleibt.`
}
```

- [ ] **Step 4: Grün beobachten**

Run: `npm test 2>&1 | tail -8`
Expected: alle pass.

- [ ] **Step 5: Commit**

```bash
git add lib/anecdotes.ts tests/lib/anecdotes.test.ts
git commit -m "Anecdote prompt block: truth material as the hook

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 7: `lib/ai.ts` — Anekdoten-Block im Anschreiben-Prompt

**Files:**
- Modify: `lib/ai.ts:375-419` (`buildCoverLetterPrompt`), `lib/ai.ts:466-490` (`generateCoverLetter`)
- Test: `tests/lib/ai.test.ts`

**Interfaces:**
- Consumes: nichts Neues (der Block kommt als fertiger String herein — `lib/ai.ts` importiert hierfür nichts aus `lib/anecdotes.ts`, keine Zirkularität)
- Produces:
  - `buildCoverLetterPrompt(resume, jobDescription, company, jobTitle?, language?, anecdoteBlock?)` — 6. optionaler Parameter.
  - `generateCoverLetter(resume, jobDescription, company, provider?, model?, apiKey?, baseUrl?, jobTitle?, language?, anecdoteBlock?)` — 10. optionaler Parameter.

- [ ] **Step 1: Rote Tests ergänzen**

In `tests/lib/ai.test.ts`:

```ts
test('prompt embeds the anecdote block before the structure, verbatim', () => {
  const prompt = buildCoverLetterPrompt('LEBENSLAUF', AD_DU_FORM, 'Firma', 'Barista', 'de', 'X-ANEKDOTEN-BLOCK')
  assert.match(prompt, /X-ANEKDOTEN-BLOCK/)
  assert.ok(prompt.indexOf('X-ANEKDOTEN-BLOCK') < prompt.indexOf('Struktur:'), 'Block muss vor der Struktur stehen')
})

test('prompt stays free of a block when none is given (backward compatible)', () => {
  const prompt = buildCoverLetterPrompt('LEBENSLAUF', AD_DU_FORM, 'Firma', 'Barista', 'de')
  assert.ok(!prompt.includes('X-ANEKDOTEN-BLOCK'))
  assert.match(prompt, /Struktur:/)
})
```

- [ ] **Step 2: Rot beobachten**

Run: `npm test 2>&1 | tail -8`
Expected: 1 fail (der erste Test — der 6. Parameter existiert nicht, TS kompiliert die Tests mit tsx trotzdem; die Assertion schlägt fehl, weil der Block fehlt). Rest grün.

- [ ] **Step 3: Minimal implementieren**

In `lib/ai.ts` — Signatur von `buildCoverLetterPrompt` (Zeile 375) erweitern:

```ts
export function buildCoverLetterPrompt(
  resume: string,
  jobDescription: string,
  company: string,
  jobTitle?: string,
  language: 'de' | 'en' = 'de',
  anecdoteBlock?: string
): string {
```

Im Template-Return, direkt nach `${languageRules}` und vor dem „Halte es kurz"-Absatz, einfügen:

```ts
${anecdoteBlock ? `\n${anecdoteBlock}\n\nBeachte: Strukturpunkt 1 (Einleitung) ist damit die Anekdote selbst — kein generischer Motivationssatz.\n` : ''}
```

Signatur von `generateCoverLetter` (Zeile 466) erweitern und durchreichen:

```ts
  jobTitle?: string,
  language: 'de' | 'en' = 'de',
  anecdoteBlock?: string
): Promise<string> {
  const ai = getAIClient(provider, apiKey, baseUrl)

  const prompt = buildCoverLetterPrompt(
    resume,
    jobDescription,
    company,
    jobTitle,
    language,
    anecdoteBlock
  )
```

- [ ] **Step 4: Grün beobachten**

Run: `npm test 2>&1 | tail -8` und `npx tsc --noEmit`
Expected: alle pass, keine neuen TS-Fehler.

- [ ] **Step 5: Commit**

```bash
git add lib/ai.ts tests/lib/ai.test.ts
git commit -m "Cover letter prompt: optional anecdote block as the opening

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 8: CRUD-Endpoints — `/api/anecdotes` und `/api/anecdotes/[id]`

**Files:**
- Create: `app/api/anecdotes/route.ts`
- Create: `app/api/anecdotes/[id]/route.ts`

**Interfaces:**
- Consumes: `sanitizeSkillsInput` aus `lib/anecdotes.ts` (Task 3), Prisma-Modell `anecdote` (Task 1)
- Produces (für Tasks 11, 12, 13, 14):
  - `GET /api/anecdotes` → JSON-Array `[{ id, title, situation, action, result, skills: string(JSON), source, createdAt, updatedAt }]`, jüngste zuerst
  - `POST /api/anecdotes` Body `{ title, situation, action, result, skills?: string[], source?: 'interview'|'manuell' }` → 201 + Anecdote
  - `PATCH /api/anecdotes/[id]` — Teilupdate, gleiche Feldregeln
  - `DELETE /api/anecdotes/[id]` → `{ ok: true }`
  - Fehler: 401 `Nicht authentifiziert`, 400 `Titel, Situation, Handlung und Ergebnis werden gebraucht — ohne sie ist es keine Geschichte.`, 404 `Anekdote nicht gefunden`

Keine Route-Tests (Hausstil): die Validierung lebt in `lib/anecdotes.ts` (getestet), die Route ist dünne Vermittlungsschicht.

- [ ] **Step 0: AGENTS.md-Pflicht**

Vor dem Schreiben: `node_modules/next/dist/docs/` — Guide zu Route Handlers und dynamischen Routen lesen (Params als Promise). Bestätigung im Task-Kommentar.

- [ ] **Step 1: `app/api/anecdotes/route.ts` anlegen**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { sanitizeSkillsInput } from '@/lib/anecdotes'

// Titel, Situation, Handlung, Ergebnis: eine Geschichte braucht alle vier.
// Skills kommen als Array herein und werden als JSON-String gelagert (wie
// matchDetails beim Job).
function storyFields(body: Record<string, unknown>):
  | { error: string }
  | { values: { title: string; situation: string; action: string; result: string } } {
  const values = {
    title: typeof body.title === 'string' ? body.title.trim() : '',
    situation: typeof body.situation === 'string' ? body.situation.trim() : '',
    action: typeof body.action === 'string' ? body.action.trim() : '',
    result: typeof body.result === 'string' ? body.result.trim() : '',
  }
  if (!values.title || !values.situation || !values.action || !values.result) {
    return { error: 'Titel, Situation, Handlung und Ergebnis werden gebraucht — ohne sie ist es keine Geschichte.' }
  }
  return { values }
}

// GET /api/anecdotes — die Sammlung, jüngste zuerst
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  const anecdotes = await prisma.anecdote.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(anecdotes)
}

// POST /api/anecdotes — speichern geht nur bestätigt: Extraktions-Vorschläge
// leben als Client-State, bis der Nutzer eine Karte übernimmt.
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  const body = (await request.json()) as Record<string, unknown>
  const result = storyFields(body)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  const anecdote = await prisma.anecdote.create({
    data: {
      userId: session.user.id,
      ...result.values,
      skills: JSON.stringify(sanitizeSkillsInput(body.skills)),
      source: body.source === 'interview' ? 'interview' : 'manuell',
    },
  })
  return NextResponse.json(anecdote, { status: 201 })
}
```

- [ ] **Step 2: `app/api/anecdotes/[id]/route.ts` anlegen**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { sanitizeSkillsInput } from '@/lib/anecdotes'

const STORY_FIELDS = ['title', 'situation', 'action', 'result'] as const

// PATCH /api/anecdotes/[id] — Teilupdate; geleerte Felder sind kein Zustand,
// sondern ein Fehler (eine Geschichte ohne Handlung ist keine).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  const { id } = await params
  const body = (await request.json()) as Record<string, unknown>

  const existing = await prisma.anecdote.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!existing) return NextResponse.json({ error: 'Anekdote nicht gefunden' }, { status: 404 })

  const data: Prisma.AnecdoteUpdateInput = {}
  for (const field of STORY_FIELDS) {
    if (body[field] !== undefined) {
      const value = typeof body[field] === 'string' ? (body[field] as string).trim() : ''
      if (!value) {
        return NextResponse.json({ error: 'Leere Felder sind keine Geschichte.' }, { status: 400 })
      }
      data[field] = value
    }
  }
  if (body.skills !== undefined) data.skills = JSON.stringify(sanitizeSkillsInput(body.skills))

  const anecdote = await prisma.anecdote.update({ where: { id }, data })
  return NextResponse.json(anecdote)
}

// DELETE /api/anecdotes/[id] — endgültig; die Fläche fragt zweistufig nach
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  const { id } = await params
  const existing = await prisma.anecdote.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!existing) return NextResponse.json({ error: 'Anekdote nicht gefunden' }, { status: 404 })
  await prisma.anecdote.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Typecheck und Lint**

Run: `npx tsc --noEmit && npm run lint 2>&1 | tail -3`
Expected: keine neuen Fehler.

- [ ] **Step 4: Commit**

```bash
git add app/api/anecdotes/route.ts app/api/anecdotes/\[id\]/route.ts
git commit -m "Anecdote CRUD endpoints

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 9: Extraktions-Endpoint — `POST /api/anecdotes/extract`

**Files:**
- Modify: `lib/ai.ts` (neuer Wrapper `generateAnecdoteProposals` am Dateiende)
- Create: `app/api/anecdotes/extract/route.ts`

**Interfaces:**
- Consumes: `buildExtractPrompt`, `sanitizeExtractedProposals`, `parseJsonLoose` aus `lib/anecdotes.ts`; `getAIClient`/`defaultModel`/`generateText` in `lib/ai.ts`; `aiConfigFromSettings`
- Produces: `generateAnecdoteProposals(answers: string[], provider?: string, model?: string, apiKey?: string, baseUrl?: string): Promise<unknown>` (wirft bei KI-Ausfall oder unlesbarem JSON); Route antwortet `{ proposals: AnecdoteInput[] }` oder 503/400.

- [ ] **Step 1: Wrapper in `lib/ai.ts` ergänzen** (importiere dazu oben: `import { buildExtractPrompt, parseJsonLoose } from './anecdotes'`)

```ts
// Vorschläge aus freitextlichen Geschichten (Mini-Interview A1). Wirft bei
// KI-Ausfall oder unlesbarem JSON — die Route antwortet ehrlich, die Antworten
// des Nutzers bleiben unverändert im Formular.
export async function generateAnecdoteProposals(
  answers: string[],
  provider: string = 'nebius',
  model?: string,
  apiKey?: string,
  baseUrl?: string
): Promise<unknown> {
  const ai = getAIClient(provider, apiKey, baseUrl)
  const { text } = await generateText({
    model: ai.chat(model || defaultModel(provider)),
    messages: [{ role: 'user', content: buildExtractPrompt(answers) }],
  })
  if (!text || text.trim().length === 0) {
    throw new Error('Die KI hat keine Vorschläge geliefert')
  }
  return parseJsonLoose(text)
}
```

- [ ] **Step 2: Route anlegen**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { aiConfigFromSettings, generateAnecdoteProposals } from '@/lib/ai'
import { sanitizeExtractedProposals } from '@/lib/anecdotes'

// POST /api/anecdotes/extract — Geschichten formen, aber nichts speichern:
// was die KI vorschlägt, bleibt Vorschlag, bis der Nutzer eine Karte bestätigt.
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const body = await request.json()
  const answers = Array.isArray(body.answers)
    ? body.answers.filter((a: unknown): a is string => typeof a === 'string' && a.trim().length > 0)
    : []
  if (answers.length === 0) {
    return NextResponse.json({ error: 'Es gibt nichts zu formen — erzähl zuerst etwas.' }, { status: 400 })
  }

  const settings = await prisma.userSettings.findUnique({ where: { userId: session.user.id } })
  const cfg = aiConfigFromSettings(settings)
  try {
    const raw = await generateAnecdoteProposals(answers, cfg.provider, cfg.model, cfg.apiKey, cfg.baseUrl)
    return NextResponse.json({ proposals: sanitizeExtractedProposals(raw) })
  } catch (error) {
    console.error('Anecdote extraction error:', error)
    return NextResponse.json(
      { error: 'Die KI ist nicht erreichbar — deine Antworten bleiben im Formular, nichts ist verloren.' },
      { status: 503 }
    )
  }
}
```

- [ ] **Step 3: Typecheck und Lint**

Run: `npx tsc --noEmit && npm test 2>&1 | tail -5`
Expected: sauber, alle Tests weiter grün.

- [ ] **Step 4: Commit**

```bash
git add lib/ai.ts app/api/anecdotes/extract/route.ts
git commit -m "Extraction endpoint: stories in, proposals out (nothing persisted)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 10: Match-Endpoint — `POST /api/anecdotes/match`

**Files:**
- Modify: `lib/ai.ts` (Wrapper `matchAnecdotesForAd`)
- Create: `app/api/anecdotes/match/route.ts`

**Interfaces:**
- Consumes: `buildMatchPrompt`, `parseJsonLoose`, `sanitizeNeeds`, `sanitizeMatches`, `parseSkills`, `AnecdoteInput`; Prisma `job`/`anecdote`
- Produces: `matchAnecdotesForAd(adDescription: string, anecdotes: Array<{ id: string } & AnecdoteInput>, provider?, model?, apiKey?, baseUrl?): Promise<unknown>`; Route antwortet `{ needs: NeedGuess[], matches: AnecdoteMatch[] }` — bei leeren Mutmaßungen (alle Zitate unbelegt) einfach mit geleerten `needs`; 503 heißt für die Fläche „unrangiert wählen"; leere Sammlung → `{ needs: [], matches: [] }`.

- [ ] **Step 1: Wrapper in `lib/ai.ts` ergänzen** (Import um `buildMatchPrompt` und `type AnecdoteInput` erweitern)

```ts
// Das zweistufige Lesen: aus der Anzeige nicht-technische Bedürfnisse mutmaßen
// (mit wörtlichen Zitatstellen — die Verifikation passiert danach in
// lib/anecdotes.ts) und die Anekdoten dazu rangieren. Wirft bei KI-Ausfall.
export async function matchAnecdotesForAd(
  adDescription: string,
  anecdotes: Array<{ id: string } & AnecdoteInput>,
  provider: string = 'nebius',
  model?: string,
  apiKey?: string,
  baseUrl?: string
): Promise<unknown> {
  const ai = getAIClient(provider, apiKey, baseUrl)
  const { text } = await generateText({
    model: ai.chat(model || defaultModel(provider)),
    messages: [{ role: 'user', content: buildMatchPrompt(adDescription, anecdotes) }],
  })
  if (!text || text.trim().length === 0) {
    throw new Error('Die KI hat keine Rangliste geliefert')
  }
  return parseJsonLoose(text)
}
```

- [ ] **Step 2: Route anlegen**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { aiConfigFromSettings, matchAnecdotesForAd } from '@/lib/ai'
import { parseSkills, sanitizeMatches, sanitizeNeeds } from '@/lib/anecdotes'

// POST /api/anecdotes/match — das zweistufige Lesen (Spec): Mutmaßungen über
// nicht-technische Bedürfnisse, jede mit wörtlicher, verifizierter Zitatstelle,
// plus Rangliste der passenden Anekdoten. KI-Ausfall → 503; die Fläche zeigt
// dann die Sammlung unrangiert zum Selbstwählen — keine Sperre.
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  const userId = session.user.id

  const body = await request.json()
  const { jobId } = body
  if (!jobId) return NextResponse.json({ error: 'Job-ID erforderlich' }, { status: 400 })

  const [job, anecdotes, settings] = await Promise.all([
    prisma.job.findFirst({ where: { id: jobId, userId } }),
    prisma.anecdote.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.userSettings.findUnique({ where: { userId } }),
  ])
  if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 })
  if (anecdotes.length === 0) return NextResponse.json({ needs: [], matches: [] })
  if (!job.description) {
    return NextResponse.json(
      { error: 'Dieser Job hat keine Beschreibung — es gibt nichts zwischen den Zeilen.' },
      { status: 400 }
    )
  }

  const cfg = aiConfigFromSettings(settings)
  try {
    const raw = (await matchAnecdotesForAd(
      job.description,
      anecdotes.map((a) => ({
        id: a.id,
        title: a.title,
        situation: a.situation,
        action: a.action,
        result: a.result,
        skills: parseSkills(a.skills),
      })),
      cfg.provider,
      cfg.model,
      cfg.apiKey,
      cfg.baseUrl
    )) as { needs?: unknown; matches?: unknown }
    const needs = sanitizeNeeds(raw.needs, job.description)
    const matches = sanitizeMatches(
      raw.matches,
      anecdotes.map((a) => a.id),
      needs.length
    )
    return NextResponse.json({ needs, matches })
  } catch (error) {
    console.error('Anecdote match error:', error)
    return NextResponse.json(
      { error: 'Die Rangliste ist gerade nicht erreichbar — du kannst selbst wählen.' },
      { status: 503 }
    )
  }
}
```

- [ ] **Step 3: Typecheck und Lint**

Run: `npx tsc --noEmit && npm test 2>&1 | tail -5`
Expected: sauber, alle Tests grün.

- [ ] **Step 4: Commit**

```bash
git add lib/ai.ts app/api/anecdotes/match/route.ts
git commit -m "Match endpoint: needs with verified quotes plus ranking

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 11: `/api/coverletter` — die gewählte Anekdote einweben

**Files:**
- Modify: `app/api/coverletter/route.ts` (komplette Neufassung der POST-Funktion)

**Interfaces:**
- Consumes: `generateCoverLetter` mit `anecdoteBlock?` (Task 7); `anecdoteToPromptBlock`, `parseSkills`, `sanitizeNeedPayload` aus `lib/anecdotes.ts`
- Produces: Body akzeptiert optional `{ anecdoteId: string, need?: { quote, need, why } }` — dem Client wird nicht vertraut: Anekdote neu geladen (Owner-Check), `need.quote` erneut gegen `job.description` verifiziert (`sanitizeNeedPayload` → `null` heißt: Anekdote ja, Mutmaßung weglassen). 404 `Anekdote nicht gefunden`, wenn die ID nicht dem Nutzer gehört.

- [ ] **Step 1: Route erweitern**

Komplette neue Fassung der Datei (Imports oben ergänzen, Body erweitern):

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { generateCoverLetter, aiConfigFromSettings } from '@/lib/ai'
import { anecdoteToPromptBlock, parseSkills, sanitizeNeedPayload } from '@/lib/anecdotes'
import { detectLanguage } from '@/lib/language'

// POST /api/coverletter — Anschreiben-Text aus dem echten Lebenslauf + dieser
// Stellenanzeige erzeugen (KI). Wird bewusst nicht persistiert: der Text gehört
// der Nutzerin — sie bearbeitet ihn hier und lädt das PDF selbst herunter
// (/api/pdf mit `content`). Kein stiller Fallback: schlägt die KI fehl,
// antwortet die Route mit einem ehrlichen Fehler statt eines Textes.
//
// Optional mit Anekdote: `anecdoteId` + `need` (die Mutmaßung aus dem Chooser).
// Dem Client wird nicht vertraut — Anekdote wird neu geladen, das Zitat erneut
// gegen den Anzeigentext verifiziert; ist es unbelegbar, webt die KI die
// Anekdote ohne Mutmaßung ein.
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  const userId = session.user.id

  const body = await request.json()
  const { jobId, anecdoteId, need } = body
  if (!jobId) return NextResponse.json({ error: 'Job-ID erforderlich' }, { status: 400 })

  const [job, resume, settings] = await Promise.all([
    prisma.job.findFirst({ where: { id: jobId, userId } }),
    prisma.resume.findFirst({ where: { userId, isActive: true } }),
    prisma.userSettings.findUnique({ where: { userId } }),
  ])

  if (!job) {
    return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 })
  }
  if (!resume) {
    return NextResponse.json(
      { error: 'Kein Lebenslauf hinterlegt — lade zuerst deinen Lebenslauf hoch.' },
      { status: 409 }
    )
  }

  let anecdoteBlock: string | undefined
  if (anecdoteId) {
    const anecdote = await prisma.anecdote.findFirst({ where: { id: anecdoteId, userId } })
    if (!anecdote) {
      return NextResponse.json({ error: 'Anekdote nicht gefunden' }, { status: 404 })
    }
    const verifiedNeed = sanitizeNeedPayload(need, job.description ?? '')
    anecdoteBlock = anecdoteToPromptBlock(
      {
        title: anecdote.title,
        situation: anecdote.situation,
        action: anecdote.action,
        result: anecdote.result,
        skills: parseSkills(anecdote.skills),
      },
      verifiedNeed
    )
  }

  const cfg = aiConfigFromSettings(settings)
  try {
    // Das Anschreiben spricht die Sprache der Anzeige — nicht die des Lebenslaufs
    const language = detectLanguage(job.description ?? '')
    const text = await generateCoverLetter(
      resume.content,
      job.description ?? '',
      job.company || 'das Unternehmen',
      cfg.provider,
      cfg.model,
      cfg.apiKey,
      cfg.baseUrl,
      job.title,
      language,
      anecdoteBlock
    )
    return NextResponse.json({ text, source: 'ki' })
  } catch (error) {
    console.error('Cover letter generation error:', error)
    return NextResponse.json(
      { error: 'Die KI ist nicht erreichbar — es wurde kein Anschreiben erzeugt. Deine Daten sind unverändert.' },
      { status: 503 }
    )
  }
}
```

- [ ] **Step 2: Typecheck, Tests, Lint**

Run: `npx tsc --noEmit && npm test 2>&1 | tail -5 && npm run lint 2>&1 | tail -3`
Expected: sauber, keine neuen Fehler, alle Tests grün.

- [ ] **Step 3: Commit**

```bash
git add app/api/coverletter/route.ts
git commit -m "Cover letter endpoint: weave in the chosen anecdote

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 12: `/resume` — Anekdoten-Sektion mit Liste und Formular

**Files:**
- Modify: `app/resume/page.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/anecdotes`, `PATCH/DELETE /api/anecdotes/[id]` (Task 8); `parseSkills`, `EXTRACT_QUESTIONS` (reine Module — client-seitig importierbar); `Button` aus `../components/ui`; `useToast`
- Produces (für Task 13): Interfaces `Anecdote`, `Proposal`; State `anecdotes`, `anecdotePanel: 'none' | 'extract' | 'manual'`, `editingAnecdote: Anecdote | null`, `proposals: Proposal[] | null`; Sektion `id="anekdoten"` (Ziel des Links aus dem Job-Detail)

Kein Unit-Test (UI — Hausstil). Prüfung: `tsc`, Lint, Detector.

- [ ] **Step 1: Imports und Interfaces ergänzen**

Oben in `app/resume/page.tsx`:

```ts
import { Button } from '../components/ui'
import { parseSkills } from '@/lib/anecdotes'
```

Unter dem `Resume`-Interface:

```ts
// Anekdoten: wahre Geschichten als Material fürs Anschreiben. `skills` kommt
// als JSON-String aus der DB und wird an der Grenze geparst.
interface Anecdote {
  id: string
  title: string
  situation: string
  action: string
  result: string
  skills: string
  source: string
  createdAt: string
}

// Vorschlag aus der Extraktion — lebt nur im Client-State, bis er bestätigt wird
interface Proposal {
  title: string
  situation: string
  action: string
  result: string
  skills: string[]
}
```

- [ ] **Step 2: State und Laden in `ResumePage` ergänzen**

Nach dem bestehenden State-Block (nach `const fileInputRef = ...`):

```ts
// Anekdoten: eigene Sektion mit eigenem Ladezyklus — sie hängt nicht am Modus
// des Lebenslaufs (view/upload/edit), sondern steht immer unten.
const [anecdotes, setAnecdotes] = useState<Anecdote[]>([])
const [anecdotePanel, setAnecdotePanel] = useState<'none' | 'extract' | 'manual'>('none')
const [editingAnecdote, setEditingAnecdote] = useState<Anecdote | null>(null)
const [proposals, setProposals] = useState<Proposal[] | null>(null)
```

Neuen Effect daneben:

```ts
useEffect(() => {
  void fetchAnecdotes()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Initial-Load, Muster der Seite
}, [])

async function fetchAnecdotes() {
  try {
    const response = await fetch('/api/anecdotes')
    if (response.ok) {
      const data = await response.json()
      setAnecdotes(Array.isArray(data) ? data : [])
    }
  } catch {
    // Stille Liste: ohne Anekdoten bleibt die Sektion einfach leer
  }
}

async function deleteAnecdote(id: string) {
  try {
    const response = await fetch(`/api/anecdotes/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      toast.error('Löschen fehlgeschlagen — die Geschichte bleibt erhalten.')
      return
    }
    setAnecdotes((prev) => prev.filter((a) => a.id !== id))
    toast.success('Anekdote gelöscht.')
  } catch {
    toast.error('Netzwerkfehler — die Geschichte bleibt erhalten.')
  }
}
```

- [ ] **Step 3: Sektion einfügen**

Direkt vor dem bestehenden `{/* Tip */}`-Block:

```tsx
{/* Anekdoten — wahre Geschichten als Material fürs Anschreiben */}
<section id="anekdoten" className="mb-6">
  <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
    <div>
      <h2 className="text-xl font-medium text-foreground">Anekdoten</h2>
      <p className="text-sm text-primary-soft">
        Wahre Geschichten, die dein Anschreiben von KI-Standardsatz trennen.
      </p>
    </div>
    <div className="flex gap-3">
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setAnecdotePanel(anecdotePanel === 'extract' ? 'none' : 'extract')}
      >
        Geschichten erzählen
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          setEditingAnecdote(null)
          setAnecdotePanel(anecdotePanel === 'manual' ? 'none' : 'manual')
        }}
      >
        Selbst schreiben
      </Button>
    </div>
  </div>

  {anecdotePanel === 'manual' && (
    <div className="mb-4">
      <AnecdoteForm
        anecdote={editingAnecdote}
        onSaved={(saved) => {
          setAnecdotes((prev) => {
            const exists = prev.some((a) => a.id === saved.id)
            return exists ? prev.map((a) => (a.id === saved.id ? saved : a)) : [saved, ...prev]
          })
          setAnecdotePanel('none')
          setEditingAnecdote(null)
          toast.success('Anekdote gespeichert.')
        }}
        onCancel={() => {
          setAnecdotePanel('none')
          setEditingAnecdote(null)
        }}
      />
    </div>
  )}

  {anecdotes.length > 0 ? (
    <div className="space-y-4">
      {anecdotes.map((a) => (
        <AnecdoteCard
          key={a.id}
          anecdote={a}
          onEdit={() => {
            setEditingAnecdote(a)
            setAnecdotePanel('manual')
          }}
          onDelete={() => void deleteAnecdote(a.id)}
        />
      ))}
    </div>
  ) : (
    anecdotePanel === 'none' && (
      <p className="text-sm text-primary-soft bg-surface rounded-2xl p-6 border border-border">
        Noch keine Anekdoten. Erzähl drei kurze Geschichten — die App formt daraus Karten.
      </p>
    )
  )}
</section>
```

- [ ] **Step 4: `AnecdoteForm` am Dateiende ergänzen** (Top-Level, nicht in render — eine in render gebaute Komponente remountet und verliert Fokus/Eingaben)

```tsx
// Formular für „Selbst schreiben" und Bearbeiten — dieselben vier Felder wie
// die Extraktions-Karten. Skills werden kommagetrennt eingegeben.
function AnecdoteForm({
  anecdote,
  onSaved,
  onCancel,
}: {
  anecdote: Anecdote | null
  onSaved: (saved: Anecdote) => void
  onCancel: () => void
}) {
  const toast = useToast()
  const [title, setTitle] = useState(anecdote?.title ?? '')
  const [situation, setSituation] = useState(anecdote?.situation ?? '')
  const [action, setAction] = useState(anecdote?.action ?? '')
  const [result, setResult] = useState(anecdote?.result ?? '')
  const [skills, setSkills] = useState(
    anecdote ? parseSkills(anecdote.skills).join(', ') : ''
  )
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!title.trim() || !situation.trim() || !action.trim() || !result.trim()) {
      toast.error('Alle vier Felder gehören zur Geschichte.')
      return
    }
    setSaving(true)
    try {
      const response = await fetch(anecdote ? `/api/anecdotes/${anecdote.id}` : '/api/anecdotes', {
        method: anecdote ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          situation,
          action,
          result,
          skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => undefined)) as { error?: string } | undefined
        toast.error(data?.error ?? 'Speichern fehlgeschlagen — die Geschichte bleibt unverändert.')
        return
      }
      onSaved(await response.json())
    } catch {
      toast.error('Netzwerkfehler — die Geschichte bleibt unverändert.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground text-sm leading-relaxed resize-y'

  return (
    <div className="bg-surface rounded-2xl p-6 border border-border space-y-4">
      <div>
        <label htmlFor="anecdote-title" className="block text-sm font-medium text-foreground mb-2">
          Titel
        </label>
        <input
          id="anecdote-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm"
          placeholder="z. B. Der Deploy-Freitag"
        />
      </div>
      <div>
        <label htmlFor="anecdote-situation" className="block text-sm font-medium text-foreground mb-2">
          Situation
        </label>
        <textarea id="anecdote-situation" value={situation} onChange={(e) => setSituation(e.target.value)} rows={2} className={inputClass} />
      </div>
      <div>
        <label htmlFor="anecdote-action" className="block text-sm font-medium text-foreground mb-2">
          Was ich getan habe
        </label>
        <textarea id="anecdote-action" value={action} onChange={(e) => setAction(e.target.value)} rows={3} className={inputClass} />
      </div>
      <div>
        <label htmlFor="anecdote-result" className="block text-sm font-medium text-foreground mb-2">
          Ergebnis
        </label>
        <textarea id="anecdote-result" value={result} onChange={(e) => setResult(e.target.value)} rows={2} className={inputClass} />
      </div>
      <div>
        <label htmlFor="anecdote-skills" className="block text-sm font-medium text-foreground mb-2">
          Qualitäten (Komma-getrennt)
        </label>
        <input
          id="anecdote-skills"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm"
          placeholder="Druck, Entscheidung, Kommunikation"
        />
      </div>
      <div className="flex gap-3">
        <Button size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? 'Speichert …' : anecdote ? 'Änderungen speichern' : 'Speichern'}
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel}>
          Abbrechen
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: `AnecdoteCard` darunter ergänzen**

```tsx
// Eine Karte, eine Geschichte: geraffte Ansicht, Bearbeiten springt ins
// Formular, Löschen ist zweistufig (zweiter Klick bestätigt, Timeout nimmt
// die Schärfe nach fünf Sekunden wieder raus).
function AnecdoteCard({
  anecdote,
  onEdit,
  onDelete,
}: {
  anecdote: Anecdote
  onEdit: () => void
  onDelete: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const skills = parseSkills(anecdote.skills)

  return (
    <div className="bg-surface rounded-2xl p-6 border border-border">
      <div className="flex items-start justify-between gap-4 mb-3">
        <h3 className="text-lg font-medium text-foreground">{anecdote.title}</h3>
        <div className="flex gap-2 flex-shrink-0">
          <Button size="sm" variant="secondary" onClick={onEdit}>
            Bearbeiten
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className={confirming ? 'bg-error/10 text-error border border-error/20 hover:bg-error/20' : undefined}
            onClick={() => {
              if (!confirming) {
                setConfirming(true)
                setTimeout(() => setConfirming(false), 5000)
                return
              }
              onDelete()
            }}
          >
            {confirming ? 'Wirklich löschen' : 'Löschen'}
          </Button>
        </div>
      </div>
      <dl className="text-sm text-primary leading-relaxed space-y-1.5 mb-3">
        <div>
          <dt className="sr-only">Situation</dt>
          <dd>
            <span className="text-primary-soft">Situation: </span>
            {anecdote.situation}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Was ich getan habe</dt>
          <dd>
            <span className="text-primary-soft">Getan: </span>
            {anecdote.action}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Ergebnis</dt>
          <dd>
            <span className="text-primary-soft">Ergebnis: </span>
            {anecdote.result}
          </dd>
        </div>
      </dl>
      {skills.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Belegte Qualitäten">
          {skills.map((skill) => (
            <li key={skill} className="px-2.5 py-1 rounded-full text-xs border border-border text-primary-soft">
              {skill}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Prüfen**

Run: `npx tsc --noEmit && npm run lint 2>&1 | tail -3 && node /home/okko/.claude/skills/impeccable/scripts/detect.mjs --json app/resume/page.tsx`
Expected: sauber, Detector `[]`.

- [ ] **Step 7: Commit**

```bash
git add app/resume/page.tsx
git commit -m "Resume page: anecdote collection with manual form

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 13: `/resume` — Extract-Panel (Mini-Interview A1)

**Files:**
- Modify: `app/resume/page.tsx`

**Interfaces:**
- Consumes: `POST /api/anecdotes/extract` (Task 9), `EXTRACT_QUESTIONS` aus `lib/anecdotes.ts`, Interfaces `Anecdote`/`Proposal` und State `proposals` (Task 12)
- Produces: Vorschlags-Karten mit Bearbeitung; Speichern geht einzeln an `POST /api/anecdotes` mit `source: 'interview'`

- [ ] **Step 1: Panel in die Sektion einhängen**

In der Anekdoten-Sektion (Task 12, Step 3) direkt nach dem Header-Block und vor dem `{anecdotePanel === 'manual' && ...}`-Block einfügen:

```tsx
{anecdotePanel === 'extract' && (
  <ExtractPanel
    onProposals={(list) => {
      setProposals(list)
      setAnecdotePanel('none')
    }}
    onCancel={() => setAnecdotePanel('none')}
  />
)}

{proposals && proposals.length > 0 && (
  <div className="mb-4 space-y-4">
    <p className="text-sm text-primary-soft">
      Vorschläge aus deinen Geschichten — prüfe jede, bevor du sie übernimmst.
    </p>
    {proposals.map((proposal) => (
      <ProposalCard
        key={proposal.title + proposal.situation}
        proposal={proposal}
        onSave={(edited) => void saveProposal(edited, proposal)}
        onDiscard={() =>
          setProposals((prev) => {
            const rest = prev?.filter((p) => p !== proposal) ?? []
            return rest.length > 0 ? rest : null
          })
        }
      />
    ))}
  </div>
)}
```

Dazu in `ResumePage` die Speicher-Funktion:

```ts
async function saveProposal(edited: Proposal, original: Proposal) {
  try {
    const response = await fetch('/api/anecdotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...edited, source: 'interview' }),
    })
    if (!response.ok) {
      const data = (await response.json().catch(() => undefined)) as { error?: string } | undefined
      toast.error(data?.error ?? 'Speichern fehlgeschlagen — der Vorschlag bleibt stehen.')
      return
    }
    const saved: Anecdote = await response.json()
    setAnecdotes((prev) => [saved, ...prev])
    setProposals((prev) => {
      const rest = prev?.filter((p) => p !== original) ?? []
      return rest.length > 0 ? rest : null
    })
    toast.success('Anekdote übernommen.')
  } catch {
    toast.error('Netzwerkfehler — der Vorschlag bleibt stehen.')
  }
}
```

- [ ] **Step 2: `ExtractPanel` und `ProposalCard` am Dateiende ergänzen**

```tsx
// Das Mini-Interview (A1): drei Leitfragen, ein KI-Aufruf. Ein Ausfall ist
// ehrlich — die Antworten bleiben im Formular, nichts ist verloren.
function ExtractPanel({
  onProposals,
  onCancel,
}: {
  onProposals: (proposals: Proposal[]) => void
  onCancel: () => void
}) {
  const [answers, setAnswers] = useState<string[]>(['', '', ''])
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function extract() {
    setExtracting(true)
    setError(null)
    try {
      const response = await fetch('/api/anecdotes/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const data = (await response.json().catch(() => undefined)) as
        | { proposals?: Proposal[]; error?: string }
        | undefined
      if (!response.ok) {
        setError(data?.error ?? 'Die KI ist nicht erreichbar — deine Antworten bleiben im Formular, nichts ist verloren.')
        return
      }
      onProposals(Array.isArray(data?.proposals) ? data.proposals : [])
    } catch {
      setError('Netzwerkfehler — deine Antworten bleiben im Formular, nichts ist verloren.')
    } finally {
      setExtracting(false)
    }
  }

  return (
    <div className="bg-surface rounded-2xl p-6 border border-border mb-4 space-y-4">
      {EXTRACT_QUESTIONS.map((question, i) => (
        <div key={question}>
          <label htmlFor={`story-${i}`} className="block text-sm font-medium text-foreground mb-2">
            {i + 1}. {question}
          </label>
          <textarea
            id={`story-${i}`}
            value={answers[i]}
            onChange={(e) =>
              setAnswers((prev) => prev.map((a, j) => (j === i ? e.target.value : a)))
            }
            rows={3}
            placeholder="Erzähl frei — Fakten, Zahlen, Namen bleiben bei dir, solange du nichts speicherst."
            className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground text-sm leading-relaxed resize-y"
          />
        </div>
      ))}
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button
          size="sm"
          onClick={() => void extract()}
          disabled={extracting || answers.every((a) => !a.trim())}
        >
          {extracting ? 'Wird geformt …' : 'Geschichten formen lassen'}
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel}>
          Abbrechen
        </Button>
      </div>
    </div>
  )
}

// Eine Karte, ein Vorschlag: alles editierbar, bevor etwas gespeichert wird.
function ProposalCard({
  proposal,
  onSave,
  onDiscard,
}: {
  proposal: Proposal
  onSave: (edited: Proposal) => void
  onDiscard: () => void
}) {
  const [title, setTitle] = useState(proposal.title)
  const [situation, setSituation] = useState(proposal.situation)
  const [action, setAction] = useState(proposal.action)
  const [result, setResult] = useState(proposal.result)
  const [skills, setSkills] = useState(proposal.skills.join(', '))
  const [saving, setSaving] = useState(false)
  // useId: mehrere Karten dürfen sich nie dieselben Label-IDs teilen
  const id = useId()

  const inputClass =
    'w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground text-sm leading-relaxed resize-y'

  return (
    <div className="bg-surface rounded-2xl p-6 border border-border space-y-3">
      <div>
        <label htmlFor={`${id}-titel`} className="block text-sm font-medium text-foreground mb-2">
          Titel
        </label>
        <input
          id={`${id}-titel`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm"
        />
      </div>
      <div>
        <label htmlFor={`${id}-situation`} className="block text-sm font-medium text-foreground mb-2">
          Situation
        </label>
        <textarea id={`${id}-situation`} value={situation} onChange={(e) => setSituation(e.target.value)} rows={2} className={inputClass} />
      </div>
      <div>
        <label htmlFor={`${id}-aktion`} className="block text-sm font-medium text-foreground mb-2">
          Was ich getan habe
        </label>
        <textarea id={`${id}-aktion`} value={action} onChange={(e) => setAction(e.target.value)} rows={3} className={inputClass} />
      </div>
      <div>
        <label htmlFor={`${id}-ergebnis`} className="block text-sm font-medium text-foreground mb-2">
          Ergebnis
        </label>
        <textarea id={`${id}-ergebnis`} value={result} onChange={(e) => setResult(e.target.value)} rows={2} className={inputClass} />
      </div>
      <div>
        <label htmlFor={`${id}-qualitaeten`} className="block text-sm font-medium text-foreground mb-2">
          Qualitäten (Komma-getrennt)
        </label>
        <input
          id={`${id}-qualitaeten`}
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm"
        />
      </div>
      <div className="flex gap-3">
        <Button
          size="sm"
          disabled={saving || !title.trim() || !situation.trim() || !action.trim() || !result.trim()}
          onClick={() => {
            setSaving(true)
            onSave({
              title,
              situation,
              action,
              result,
              skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
            })
            setSaving(false)
          }}
        >
          Übernehmen
        </Button>
        <Button size="sm" variant="secondary" onClick={onDiscard}>
          Verwerfen
        </Button>
      </div>
    </div>
  )
}
```

Hinweis: Der Import von `EXTRACT_QUESTIONS` ergänzt den bestehenden Import aus Task 12: `import { EXTRACT_QUESTIONS, parseSkills } from '@/lib/anecdotes'`. Die React-Importzeile der Seite wird um `useId` erweitert: `import { useEffect, useState, useRef, useId } from 'react'`.

- [ ] **Step 3: Prüfen**

Run: `npx tsc --noEmit && npm run lint 2>&1 | tail -3 && node /home/okko/.claude/skills/impeccable/scripts/detect.mjs --json app/resume/page.tsx`
Expected: sauber, Detector `[]`.

- [ ] **Step 4: Commit**

```bash
git add app/resume/page.tsx
git commit -m "Resume page: guided story extraction panel

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 14: Job-Detail — die Wahl vor dem Erzeugen

**Files:**
- Modify: `app/jobs/[id]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/anecdotes`, `POST /api/anecdotes/match` (Task 10), erweitertes `POST /api/coverletter` mit `{ anecdoteId, need }` (Task 11)
- Produces: nichts nach außen — Client-State `chooser`, `chosenAnecdote`, `matching`, `anecdoteHint`

Kein Unit-Test (UI — Hausstil). Prüfung: `tsc`, Lint, Detector.

- [ ] **Step 1: Client-Interfaces ergänzen**

Bei den Interface-Deklarationen der Seite (vor der Default-Export-Funktion):

```ts
// Chooser-Typen — spiegelbildlich zu den Responses der Anecdotes-API
interface NeedGuessClient {
  quote: string
  need: string
  why: string
}

interface AnecdoteMatchClient {
  anecdoteId: string
  reason: string
  addresses: number[]
}

interface AnecdoteClient {
  id: string
  title: string
  situation: string
  action: string
  result: string
  skills: string
  source: string
}
```

- [ ] **Step 2: State ergänzen**

Nach `const [letterError, setLetterError] = useState<string | null>(null)`:

```ts
// Anekdoten-Chooser: die Wahl VOR der Generierung (Spec: „Nutzer wählt vorab").
// `ranked: false` heißt, der Match-Aufruf ist fehlgeschlagen — die Sammlung
// erscheint unrangiert zum Selbstwählen, beschriftet als Ausnahme.
const [chooser, setChooser] = useState<{
  needs: NeedGuessClient[]
  matches: AnecdoteMatchClient[]
  anecdotes: AnecdoteClient[]
  ranked: boolean
} | null>(null)
const [chosenAnecdote, setChosenAnecdote] = useState<string>('none')
const [matching, setMatching] = useState(false)
const [anecdoteHint, setAnecdoteHint] = useState(false)
```

- [ ] **Step 3: `handleGenerateLetter` erweitern**

Signatur (Zeile ~181) und Body-Aufruf ändern:

```ts
async function handleGenerateLetter(
  useTemplate = false,
  anecdote?: { anecdoteId: string; need?: NeedGuessClient }
) {
```

Im KI-Zweig (nicht im Vorlagen-Zweig) den Body erweitern:

```ts
      const response = await fetch('/api/coverletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          ...(anecdote ? { anecdoteId: anecdote.anecdoteId, need: anecdote.need } : {}),
        }),
      })
```

- [ ] **Step 4: Chooser-Funktionen ergänzen** (nach `handleGenerateLetter`)

```ts
// Der Weg zum Anschreiben läuft über die Wahl: erst prüfen, ob es Anekdoten
// gibt (leerer Bestand → Generierung wie bisher plus ein Angebot, kein
// Vorwurf), dann das zweistufige Lesen der Anzeige. KI-Ausfall beim Matchen
// ist keine Sperre — die Sammlung erscheint unrangiert zum Selbstwählen.
async function startLetterGeneration() {
  if (!job || busy || matching) return
  setAnecdoteHint(false)
  setMatching(true)
  try {
    const listResponse = await fetch('/api/anecdotes')
    if (!listResponse.ok) {
      await handleGenerateLetter(false)
      return
    }
    const anecdotes: AnecdoteClient[] = await listResponse.json()
    if (!Array.isArray(anecdotes) || anecdotes.length === 0) {
      setAnecdoteHint(true)
      await handleGenerateLetter(false)
      return
    }
    const response = await fetch('/api/anecdotes/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job.id }),
    })
    if (response.ok) {
      const data = await response.json()
      const needs: NeedGuessClient[] = Array.isArray(data.needs) ? data.needs : []
      const matches: AnecdoteMatchClient[] = Array.isArray(data.matches) ? data.matches : []
      setChooser({ needs, matches, anecdotes, ranked: true })
      // Beste Vorgabe (Spec): der erste Rang ist vorab gewählt
      setChosenAnecdote(matches[0]?.anecdoteId ?? 'none')
    } else {
      setChooser({ needs: [], matches: [], anecdotes, ranked: false })
      setChosenAnecdote('none')
    }
  } catch {
    // Netzwerk: ohne Chooser direkt generieren, wie bisher
    await handleGenerateLetter(false)
  } finally {
    setMatching(false)
  }
}

async function generateFromChooser() {
  if (!job || !chooser) return
  const match = chooser.matches.find((m) => m.anecdoteId === chosenAnecdote)
  const need = match ? chooser.needs[match.addresses[0]] : undefined
  setChooser(null)
  await handleGenerateLetter(
    false,
    chosenAnecdote !== 'none' ? { anecdoteId: chosenAnecdote, need } : undefined
  )
}
```

- [ ] **Step 5: Reihenfolge der Karten berechnen**

Nach dem Render-Zeit-Sync-Block (`if (job && job.id !== loadedJobId) {...}`):

```ts
// Rangierte zuerst (in Reihenfolge der Rangliste, mit Begründung), dann der
// Rest der Sammlung — die Wahl bleibt immer vollständig wählbar.
const orderedChoices = chooser
  ? [
      ...chooser.matches
        .map((m) => ({
          anecdote: chooser.anecdotes.find((a) => a.id === m.anecdoteId),
          reason: m.reason as string | undefined,
        }))
        .filter((entry): entry is { anecdote: AnecdoteClient; reason: string } => entry.anecdote !== undefined),
      ...chooser.anecdotes
        .filter((a) => !chooser.matches.some((m) => m.anecdoteId === a.id))
        .map((a) => ({ anecdote: a, reason: undefined as string | undefined })),
    ]
  : []
```

- [ ] **Step 6: Anschreiben-Block umschreiben**

Im Anschreiben-Card („Anschreiben — das Artefakt, das einen Menschen erreicht") die Bedingungen anpassen. Der bisherige Intro-Block `{!letter && !letterError && (...)}` wird zu drei Blöcken:

```tsx
          {!letter && !letterError && !chooser && (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-primary leading-relaxed max-w-prose">
                Aus deinem Lebenslauf und dieser Stellenanzeige — zum Bearbeiten, bevor du sie
                verschickst.
              </p>
              <Button onClick={() => void startLetterGeneration()} disabled={busy !== null || matching}>
                {matching ? 'Wird geprüft …' : busy === 'generate' ? 'Wird erzeugt …' : 'Anschreiben erzeugen'}
              </Button>
            </div>
          )}

          {/* Der Chooser: erst die Mutmaßungen (mit geprüften Zitatstellen), dann die Wahl */}
          {!letter && !letterError && chooser && (
            <div>
              <h3 className="text-sm font-medium text-foreground mb-1">
                Was die Anzeige zwischen den Zeilen sucht
              </h3>
              <p className="text-xs text-primary-soft mb-3">
                Mutmaßung, nicht Gewissheit — jede Belegstelle wurde wörtlich gegen den
                Anzeigentext geprüft.
              </p>
              <ul className="space-y-2 mb-5">
                {chooser.needs.map((guess) => (
                  <li key={guess.need} className="text-sm bg-background rounded-xl border border-border-soft p-3">
                    <p className="text-foreground">{guess.need}</p>
                    <p className="text-primary-soft mt-1">Zitat: „{guess.quote}“</p>
                    {guess.why && <p className="text-primary-soft mt-1">{guess.why}</p>}
                  </li>
                ))}
                {chooser.needs.length === 0 && (
                  <li className="text-sm text-primary-soft">
                    Keine belegten Mutmaßungen — die Anzeige sagt wenig zwischen den Zeilen.
                  </li>
                )}
              </ul>
              <fieldset>
                <legend className="text-sm font-medium text-foreground mb-2">
                  Welche Anekdote öffnet das Anschreiben?
                </legend>
                {!chooser.ranked && (
                  <p className="text-xs text-warning mb-2">
                    Rangliste gerade nicht verfügbar — wähle selbst.
                  </p>
                )}
                <div className="space-y-2">
                  {orderedChoices.map(({ anecdote, reason }) => (
                    <label
                      key={anecdote.id}
                      className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                        chosenAnecdote === anecdote.id ? 'border-selection' : 'border-border'
                      }`}
                    >
                      <input
                        type="radio"
                        name="anekdote-wahl"
                        value={anecdote.id}
                        checked={chosenAnecdote === anecdote.id}
                        onChange={() => setChosenAnecdote(anecdote.id)}
                        className="mt-1 accent-selection"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">{anecdote.title}</span>
                        {reason ? (
                          <span className="block text-xs text-primary-soft mt-0.5">{reason}</span>
                        ) : (
                          <span className="block text-xs text-primary-soft mt-0.5">
                            {anecdote.situation.slice(0, 90)}
                            {anecdote.situation.length > 90 ? '…' : ''}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                  <label
                    className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                      chosenAnecdote === 'none' ? 'border-selection' : 'border-border'
                    }`}
                  >
                    <input
                      type="radio"
                      name="anekdote-wahl"
                      value="none"
                      checked={chosenAnecdote === 'none'}
                      onChange={() => setChosenAnecdote('none')}
                      className="mt-1 accent-selection"
                    />
                    <span className="text-sm text-foreground">Ohne Anekdote — klassisches Anschreiben</span>
                  </label>
                </div>
              </fieldset>
              <div className="flex flex-wrap gap-3 mt-4">
                <Button onClick={() => void generateFromChooser()} disabled={busy !== null || matching}>
                  {busy === 'generate' ? 'Wird erzeugt …' : 'Anschreiben erzeugen'}
                </Button>
                <Button variant="secondary" onClick={() => setChooser(null)}>
                  Abbrechen
                </Button>
              </div>
            </div>
          )}

          {/* Leerer Bestand: kein Vorwurf, ein Angebot */}
          {!letter && !letterError && !chooser && anecdoteHint && (
            <p className="text-xs text-primary-soft mt-3">
              Tipp: Eine wahre Anekdote hebt dein Anschreiben von KI-Standardsatz ab.{' '}
              <Link
                href="/resume#anekdoten"
                className="underline decoration-selection/60 underline-offset-4 hover:text-foreground hover:decoration-selection"
              >
                Anekdoten anlegen
              </Link>
            </p>
          )}
```

Zusätzlich: Falls `Link` oben noch nicht importiert ist (`import Link from 'next/link'`), ergänzen. Und den „Neu erzeugen"-Button im `letter`-Block auf denselben Weg stellen:

```tsx
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void startLetterGeneration()}
                  disabled={busy !== null || matching}
                >
                  {matching ? 'Wird geprüft …' : 'Neu erzeugen'}
                </Button>
```

- [ ] **Step 7: Prüfen**

Run: `npx tsc --noEmit && npm run lint 2>&1 | tail -3 && node /home/okko/.claude/skills/impeccable/scripts/detect.mjs --json app/jobs/\[id\]/page.tsx`
Expected: sauber, Detector `[]`.

- [ ] **Step 8: Commit**

```bash
git add app/jobs/\[id\]/page.tsx
git commit -m "Job detail: choose the anecdote before generating

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 15: Datenschutz-Zusatz und Gesamtprüfung

**Files:**
- Modify: `app/datenschutz/page.tsx`

**Interfaces:** keine — ein ehrlicher Satz (Spec: „Datenschutz bleibt ehrlich").

- [ ] **Step 1: Satz ergänzen**

In der Sektion „Beteiligte Dienste", im Absatz zur KI-Übertragung, direkt nach „…zu keinem anderen Zweck und an niemand sonst.":

```
 Für das Anekdoten-Mini-Interview und die Anschreiben-Erzeugung kommen zusätzlich
 deine Anekdoten-Texte an denselben Provider — ebenfalls nur zu diesem Zweck.
```

- [ ] **Step 2: Gesamtprüfung**

Run (alles muss sauber sein):

```bash
npm test 2>&1 | tail -5
npx tsc --noEmit
npm run lint 2>&1 | tail -3
npm run build 2>&1 | tail -10
node /home/okko/.claude/skills/impeccable/scripts/detect.mjs --json app/resume/page.tsx app/jobs/\[id\]/page.tsx app/datenschutz/page.tsx
```

Expected: alle Tests grün (73 + ~20 neue), keine neuen Lint-Fehler (die 7 Altlasten in `lib/apify.ts`/`lib/platforms.ts` bleiben unberührt), Build erfolgreich, Detector `[]`.

- [ ] **Step 3: Commit**

```bash
git add app/datenschutz/page.tsx
git commit -m "Privacy page: anecdotes travel to the AI provider

Co-Authored-By: Claude <noreply@anthropic.com>"
```

- [ ] **Step 4: Nicht pushen**

Der Nutzer sagt explizit „push", wenn gepusht werden soll — bis dahin bleiben alle Commits lokal. `Lebenslauf.docx` bleibt in jedem Fall untracked.
