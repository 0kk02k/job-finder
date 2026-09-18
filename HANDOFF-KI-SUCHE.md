# Handoff: KI-Bewertung der Jobsuche — Untersuchungsstand 17.09.2026 (Abend)

> Für die übernehmende KI: Alles folgende ist belegt, die Quellen (Code-Stellen, Logs, DB-Queries, Messskripte) sind genannt. Aufgabe: Review der Kausalkette und Entscheidung/Freigabe für Plan B bzw. C.

## 1. Symptom

- Die Jobsuche findet Treffer (z. B. 171 über Remotive/Arbeitnow/Jooble/Arbeitsagentur), aber **nie wird ein Job durch die KI bewertet**. DB-Beweis: `SELECT count(*) FROM "Job" WHERE score IS NOT NULL` → **0** (über die gesamte Historie).
- Alle KI-Calls **aus Vercel-Produktion** enden am Abort-Guard mit `TimeoutError` (DOMException code 23). Dieselben Calls **vom lokalen Rechner (DE, Heimanschluss)** antworten schnell.
- Der Nutzer muss Treffer aktuell manuell übernehmen und einzeln „Bewerten" klicken — auch das scheitert mit denselben Timeouts.

## 2. Betroffene Architektur (Kurzform)

- `app/api/search/route.ts` — NDJSON-Stream; semantische Suche → Ranking in **15er-Chunks** (8 parallel, 30s-Guard, `semanticJobSearch`), bei Totalausfall Anzeige des ungeranketen Pools (`rankingFailed`-Flag); Fall-through zur klassischen Suche nur mit Restbudget (`phaseFitsInBudget`, 35s-Regel); Scoring-Welle 8 parallel, 25s-Guard + 1 Retry, `SCORE_LIMIT` 50, Gesamtfrist 50s/10s Puffer, `maxDuration` 60.
- `lib/ai.ts` — `generateTextGuarded(params, timeoutMs, retries, deadline?)`: Abort-Timeout pro Versuch, auf Restfrist gekappt (`attemptTimeoutMs`). Scoring/Ranking/Fächer laufen auf **`zai-org/GLM-5.3-Flash`** (`NEBIUS_SCORING_MODEL`), Hauptmodell (Anschreiben, Interview, Verbindungstest) ist **`moonshotai/Kimi-K3`**.
- Key-Quelle: `aiConfigFromSettings` — `UserSettings.nebiusApiKey` schlägt `process.env.NEBIUS_API_KEY`.
- Provider: Nebius Token Factory, `https://api.tokenfactory.nebius.com/v1` (EU-Anbieter).
- Deploy: git push auf main → automatischer Prod-Deploy. `vercel.json` seit `ed3a9f0`: `"regions": ["fra1"]`.

## 3. Chronologie der Beweise

1. **14.09.**: Beide 60er-Ranking-Chunks starben gleichzeitig am 30s-Guard; 60s-Kill ohne Ergebnis. Fix-Pakete: `9c680f0` (Frist-Erzwingung: Chunk 15, `attemptTimeoutMs`, `phaseFitsInBudget`, Kompakt-Prompt-Vertrag) und `a39a780` (Live-Strom: `onRanked`/`onPool`, `jobs`-Events, `mergeStreamedJobs`, ungeranketer Pool statt Fehlerwand). Timeouts blieben.
2. **17.09.**: Identische Timeouts. Settings-Zeile: `nebiusApiKey` **leer** bis zum Nachmittag (Key lag nur als Vercel-Env-Var „Secret", vom CLI nicht pull-bar).
3. **Ohne Key** failt ein Call in 0,0s mit `AI_LoadAPIKeyError` (lokal nachgestellt). Prod-Calls hängen also **mit** Key.
4. **Verbindungstest gegen die Env-Var** (auf dem fra1-Deploy, 16:13): **`AI_APICallError … statusCode: 401 Unauthorized`** mit `model: 'moonshotai/Kimi-K3'` — der in Vercel hinterlegte Wert ist eine **tote Key-Instanz** (Call kommt an, wird abgewiesen). Nutzer speicherte danach einen **frischen Key in den Einstellungen** → „Verbindung steht" ⇒ **Kimi-K3 ist aus prod erreichbar**.
5. **Modellliste** (`/v1/models` mit gültigem Key): 24 Modelle, u. a. `zai-org/GLM-5.3-Flash` (**existiert**), `zai-org/GLM-5.3`, `GLM-5.2`, `GLM-5.1`, `moonshotai/Kimi-K3`, `Kimi-K2.6`, `Kimi-K2.7-Code`.
6. **Messung lokal (DE)**, roher `fetch` mit dem gültigen Settings-Key:
   - Kimi-K3, winzig: **200 in 0,6s**
   - GLM-5.3-Flash, winzig: **200 in 4,5s**
   - GLM-5.3-Flash, realistischer Ranking-Chunk (26.277 Zeichen Prompt, usage 6073→1148 Tokens): **200 in 12,6s** — wäre locker innerhalb des 30s-Guards.
7. **Aus prod**: GLM-Flash-Calls hängen bis zum Guard (Fan 10s, Ranking 30s, Scoring 25s + Retry „Versuch 2/2"), **sowohl aus iad1 (US, Default) als auch nach Regionwechsel fra1** (Log 16:34–16:35: manuelles Einzel-Scoring, beide Versuche `TimeoutError`).
8. Manual-Scoring-Route `app/api/jobs/[id]/score` nutzt `scoreJob` ohne `deadline` → Guard 25s + 1 Retry — passt exakt zum Logbild „Versuch 1/2, 2/2".

## 4. Hypothesen und Status

| Hypothese | Status | Beleg |
|---|---|---|
| Prompt/Chunks zu groß | ✗ widerlegt | 15er-Chunks scheitern wie 60er; winziger Query-Fächer (10s-Guard) scheitert genauso |
| Modell-ID ungültig | ✗ widerlegt | steht in `/v1/models`; antwortet lokal mit 200 |
| Key fehlt | ✗ widerlegt | ohne Key: sofortiger `AI_LoadAPIKeyError`, kein Timeout |
| 401/402/429 (Konto/Guthaben) | ✗ widerlegt | Fehlerantworten kämen schnell; prod sieht nur Timeouts; Verbindungstest mit frischem Key: 200 |
| **Netz-Weg Vercel→Nebius, GLM-Pool** | ✓ Hauptverdacht | fra1 brachte keine Besserung ⇒ kein Geo-Problem, sondern IP-Klassen-/Poolspezifisches: Vercel-AWS-Egress wird vom GLM-Serving-Pool nicht bedient (Blackhole/Throttle), der Kimi-Pool schon. Lokal (Privat-IP) beide OK. |

Offene Teilfrage: Warum bedient der Provider aus prod Kimi, aber nicht GLM? (Verschiedene Serving-Pools mit unterschiedlicher IP-Politik wäre die naheliegende Erklärung; vom hier nicht einsehbaren Provider-Verhalten abhängig.)

## 5. Nächste Schritte

- **Plan B (bereit zur Umsetzung): Scoring-Modell wechseln** — `NEBIUS_SCORING_MODEL` in `lib/ai.ts` von `zai-org/GLM-5.3-Flash` auf `moonshotai/Kimi-K2.6`, dazu Testanpassung (`scoringModel('nebius')` in `tests/lib/ai.test.ts`). Vorher K2.6 lokal mit dem Ranking-Chunk-Messskript timen (Methode wie in Abschnitt 3.6). Begründung: der Kimi-Pool ist aus prod **beweisbar** erreichbar. Risiko: K2.6-Denkgeschwindigkeit auf offenen Prompts unbekannt — Guards (25s/30s) stehen und messen das dann ehrlich aus.
- **Plan C (falls B scheitert): EU-Relay** — Cloudflare Worker o. ä. als Reverse-Proxy vor `api.tokenfactory.nebius.com`, `baseUrl` konfigurierbar machen (Settings/Env), dadurch verlässt der Traffic Vercels Egress-IP-Klassen.
- **Unabhängig**: Vercel-Env `NEBIUS_API_KEY` auf denselben gültigen Wert setzen wie in den Einstellungen (heute: 401) oder bewusst dokumentieren, dass der Settings-Key die Quelle der Wahrheit ist (Todo #5 im Task-List).
- **Diag-Idee für schnelle Modellvergleiche aus prod**: temporärer, `CRON_SECRET`-geschützter Endpunkt, der winzige Calls gegen mehrere Modell-IDs (K2.6, GLM-5.3, GLM-5.2) misst und Status+Latency zurückgibt. (Session-Auth verhindert externes Testen der bestehenden Routen; `CRON_SECRET` ist Config-Var und pull-bar.)

## 6. Code-Stand (letzte Pakete, alle gepusht)

- `9c680f0` — Frist-Erzwingung: `attemptTimeoutMs`/`deadline` in Guards, `phaseFitsInBudget`, Chunk 60→15, Kompakt-Vertrag im Ranking-Prompt, fristgebundene Upsert-Schleifen.
- `a39a780` — Live-Strom: `onRanked`/`onPool` in `semanticSearch`, `jobs`-Stream-Events, `mergeStreamedJobs`, ungeranketer Pool mit `rankingFailed` statt Fehlerwand, Karten erscheinen chunkweise.
- `ed3a9f0` — `vercel.json` `"regions": ["fra1"]` (Plan A — für GLM wirkungslos, Region bleibt trotzdem sinnvoll: EU-nahe Functions).
- Tests: **132 grün** (`npm test`), `tsc --noEmit` sauber, ESLint auf geänderten Dateien sauber.
- Kontaktstellen für Plan B: `lib/ai.ts` (`NEBIUS_SCORING_MODEL`), `tests/lib/ai.test.ts` (2 Assertions auf die ID), ggf. Kommentar in `lib/ai.ts:23ff` (Verifikations-Hinweis Modell-IDs).

## 7. Für die Review kritische Punkte

1. Ist die Kausalkette (Provider-Erreichbarkeit abhängig von Egress-IP-Klasse, modellpoolspezifisch) schlüssig — oder übersehen wir eine Erklärungsebene (z. B. AI-SDK-Verhalten, Header, HTTP/2, Keep-alive, Vercel-Fluid-spezifisches Fetch)?
2. Plan B richtig bestückt — K2.6 vs. `GLM-5.3` (full) vs. ganz anderer Provider fürs Scoring?
3. Sollte die App das Modellwahl-Risiko bündeln (z. B. Fallback-Kette: GLM-Flash → K2.6 bei Guard-Timeout im Lauf selbst) statt statischer Modell-ID?

## 8. Addendum 17.09.2026 (später Abend, Nachfolge-Session): Plan B umgesetzt — plus neue Befunde

### Neue Messungen (lokal, Settings-Key, roher fetch bzw. SDK-Pfad)

- **K2.6 Ranking-Chunk (15 Jobs):** ohne Schalter **19,6s / 4.716 Output-Tokens** (K2.6 ist ein Thinking-Modell; Nebius weist das Reasoning nicht als `reasoning_content` aus, rechnet es aber als Output ab — bei gekapptem `max_tokens` kam dadurch **leerer content** zurück). Mit **`chat_template_kwargs: { thinking: false }`: 2,7–3,0s / 499–554 Tokens**, valides Ranking-JSON.
- **`reasoning_effort: 'none'` drosselt nur** (Ranking 12,9s / 2.643 Tokens) — bei Nebius kein vollständiger Aus-Schalter. Der SDK-native Weg (`providerOptions.openai.reasoningEffort`) reicht damit nicht.
- **GLM-5.3-Flash lokal: Timeout bei 45s** (am Vortag noch 12,6s) — der Pool ist jetzt **auch außerhalb Vercels** gestört. GLM-5.3 (full) antwortet lokal winzig in 1,4s, ist aber ebenfalls Thinking-Modell.

### Antworten auf die Review-Fragen (§7)

1. **Kausalkette:** Die reine „Vercel-Egress-IP-Klasse"-Erklärung ist durch den neuen lokalen GLM-Flash-Timeout geschwächt — näher liegt eine **Degradation des GLM-Flash-Serving-Pools** (aus Vercel 100 % Ausfall seit ~13.09., lokal jetzt ebenfalls). AI-SDK-/Header-/HTTP-Ebene als Timeout-Ursache geprüft und ausgeschlossen: derselbe SDK-Pfad liefert mit Kimi-Modellen in 1,5–4s. Die SDK-Ebene war trotzdem relevant — für das Denk-Problem (s. o.): `chat_template_kwargs` wird nicht durchgereicht, der Chat-Pfad sendet `reasoning_effort` ungefiltert mit.
2. **Plan B-Bestückung:** **K2.6 bestätigt.** GLM-5.3 (full) wäre derselbe Provider-Pool-Typus mit unbekannter Politik und eigenem Denk-Overhead; ein ganz anderer Provider ist Plan C. K2.6 liegt im beweisbar erreichbaren Kimi-Pool (Verbindungstest 16:13, K3 mit 200).
3. **Fallback-Kette:** **nicht gebaut** — statischer Wechsel. Im Fehlerbild „Pool tot" würde eine Laufzeit-Kette pro Call erst die volle Guard-Zeit (10–30s) verbrennen, bevor sie wechselt; bei ~60 KI-Calls pro Suche wäre das fatal. Die Guards bleiben das ehrliche Messinstrument. Fällt auch K2.6 aus prod aus, bleibt Plan C (EU-Relay).

### Umgesetzt (Plan B)

- `lib/ai.ts`: `NEBIUS_SCORING_MODEL = 'moonshotai/Kimi-K2.6'`; neu `noThinkingFetch` (injiziert `chat_template_kwargs.thinking:false` in POST-Bodies) + `scoringChat(...)` als einziger Einstieg fürs schnelle Modell (Modell-ID und Denk-Abschaltung untrennbar). Alle Scoring-Call-Sites umgestellt: `semanticJobSearch`, `scoreJob`, `generateSearchQueries`, Präferenz-Gespräch (3 Stellen), HR-Interview. Hauptmodell K3 (Anschreiben, Insights etc.) unverändert **mit** Denken.
- `generateSearchQueries` nimmt jetzt `apiKey`/`baseUrl` — vorher lief der Query-Fächer **nur** über die Env-Var, also in prod gegen den toten 401-Key (§3.4). Beide Aufrufer in `app/api/search/route.ts` reichen die Settings-Config durch.
- Kommentare mit GLM-Referenzen aktualisiert (search route, cron score, preference-profile).
- Tests: **134 grün** (2 neu: `noThinkingFetch` injiziert korrekt / lässt Nicht-JSON unberührt), `tsc --noEmit` sauber, ESLint auf geänderten Dateien sauber.
- E2E lokal über den Produktionspfad: `scoreJob` 4,1s (Score 10, valides JSON), `semanticJobSearch` 1,5s (2 von 3 korrekt gerankt, Buchhalter korrekt raus), `generateSearchQueries` 1,6s (10 Queries).

### Offen nach dem Deploy (push auf main = Prod-Deploy)

1. **Live-Beweis:** Suche in prod laufen lassen → `SELECT count(*) FROM "Job" WHERE score IS NOT NULL` muss von 0 wegkommen; die Suche muss gerankte Treffer streamen statt `rankingFailed`.
2. **Vercel-Env `NEBIUS_API_KEY`** auf den gültigen Wert setzen (steht heute auf der toten 401-Instanz) — betrifft noch `lib/platforms.ts` (`getAIClient(aiProvider)` ohne Key) und jeden Env-Fallback.
3. Falls K2.6 aus prod wider Erwarten hängt: Plan C (EU-Relay, `baseUrl` konfigurierbar).

---

## 9. Addendum 18.09.2026: Live-Beweis erbracht — die KI-Bewertung läuft in prod

- **Live-Suche des Nutzers in prod:** `score IS NOT NULL` ging von **0 → 40** (40 von 41 gefundenen Jobs bewertet). Semantischer Pfad, Ranking und Scoring laufen mit K2.6 (thinking off) wie lokal gemessen. Damit ist Punkt 1 erledigt; **Plan C (EU-Relay) ist nicht nötig**.
- **Punkt 2 (Vercel-Env `NEBIUS_API_KEY`) weiterhin offen** — Status unbekannt. Die App funktioniert, weil der Settings-Key die Quelle der Wahrheit ist (`aiConfigFromSettings`), aber jeder Env-Fallback (u. a. `lib/platforms.ts`) läuft weiter gegen die tote 401-Instanz.
- **K2.6 aus prod:** kein einziger Hänger seit dem Wechsel — bestätigt, dass das Problem der GLM-Serving-Pool war, nicht Vercels Egress.

### In derselben Session mitgefixt (alles gepusht)

- **DOCX-Upload:** die Upload-Route decodierte `.docx` roh als UTF-8 → `extractDocxText` in `lib/docx.ts` (jszip). Der aktive Lebenslauf war ein 33-Zeichen-Skeleton, nach Fix 2296 Zeichen echter Text.
- **Erklärseite `/so-funktionierts`** (verlinkt im Footer + unter „Erste Schritte").
- **Zwei Impeccable-Critique-Läufe** (Dual-Agent, Snapshots in `.impeccable/critique/`): 29/40 → 30/40; alle Priority Issues in drei Commit-Paketen gefixt (Jobs-Toolbar-Verdichtung, JobCard-Kürzungen, Shortcuts S/J/K/Enter, Mehrfachauswahl, „Rückstand bewerten"-Button, Erklärlinks, Leere-Suche-Hebel, Absage-Trichter, Settings-Save-Modell inkl. **docTemplate-Persistierung** (war toter Endpunkt), Bewerben-Gruppe auf Job-Detail, „Gespräch"→„Interview", Interview-Neustart-Confirm, Chat-Scrollverhalten, „+ Suche speichern" bei 0 Funden, Toasts statt Stillfehlern).
- **Kontrast-Fix:** `--stone-soft` light von `#78716c` (~4,2:1 auf Papier, 3,7:1 auf Ocker-Tint) auf **`#6b645e`** (≥4,5:1 überall, AA) — Token-Änderung in `app/globals.css`, DESIGN.md nachgezogen.
- **Settings-Seite in Alltagssprache** für Nicht-Tech-Nutzer (Key-Felder, Provider-Auswahl, Portal-Sync, Fehlermeldungen — Eingabewerte unverändert).
- **Interview-Seite:** 16Personalities-Vorbereitungs-Karte (Startbereich, Card-Komponente, externer Link, ehrlicher Hinweis „Selbstbild, keine Diagnose").
- **Werkstudent-/Praktikums-Filter im Scoring** (`lib/ai.ts`): Titel-/Beschreibungssignale („Werkstudent", „Praktikum", „Working Student", „Intern", „Trainee") werden **deterministisch ohne LLM-Call** erkannt und auf **Score ≤ 3 mit deutscher Begründung** (in `scoreReason`) gedeckelt; im semantischen Ranking wird die Relevanz analog auf ≤ 0,3 gedrückt. Such-Breite unverändert — der Filter greift erst bei der Bewertung. 11 neue Tests.
- **Tests: 147 grün**, `tsc --noEmit` sauber, Build kompiliert, ESLint ohne neue Probleme (13 altbestandene in `lib/apify.ts`/`platforms.ts`/`autoapply.ts` + 2 react-hooks-Warnings in den jobs-Seiten, absichtlich nicht angerührt).

### Weiterhin offen

- Backfill: bereits gespeicherte Werkstudent-Jobs mit hohem Score werden nicht zurückwirkend neu bewertet (Score löschen oder einzeln nachscoren lässt sie vom Cron/neuem Lauf erfassen).
- Vercel-Env `NEBIUS_API_KEY` (s. o.).
- HR-Interview: dieselben Guard-Defekte wie früher dokumentiert (kein Guard, Substring-Filter, kein Abschließen-Button) — unverändert offen; Zwei-Phasen-Merge der Interviews war der beschlossene nächste Schritt.
