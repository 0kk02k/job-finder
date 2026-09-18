// AI integration for job scoring, resume matching, and intelligent job extraction
// Supports: Nebius Token Factory (Default, Kimi K3), Ollama (local), Gemini, OpenRouter

import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import {
  AnecdoteInput,
  buildExtractPrompt,
  buildMatchPrompt,
  parseJsonLoose,
} from './anecdotes'
import {
  PreferenceProfile,
  condensePreferenceProfile,
  renderPreferenceBlock,
} from './preferences'

// Ein Ort, eine Wahrheit: die Standard-Modell-ID für Nebius Token Factory.
// (Im Studio verifizierbar über „Copy model ID".)
// Verifiziert gegen https://api.tokenfactory.nebius.com/v1/models (09/2026):
// K2.5 wurde vom Provider gesunset, K3 ist der Nachfolger. Modell-IDs bei
// Nebius immer gegen die Live-Liste prüfen, bevor sie hier landen.
export const NEBIUS_DEFAULT_MODEL = 'moonshotai/Kimi-K3'

export interface ScoreResult {
  score: number | null // 1-10, null wenn die KI nicht bewerten konnte
  reason: string
  gaps: string[]
  strengths: string[]
}

export interface SemanticSearchResult {
  query: string
  jobs: SemanticJob[]
  fuzzyMatches: string[] // Jobs that might match but aren't exact
}

export interface SemanticJob {
  title: string
  company: string
  location: string
  description: string
  url: string
  platform: string
  relevanceScore: number // 0-1 semantic similarity
  matchReason: string // Why it matches
  transferableSkills: string[] // Skills from resume that apply
}

export interface ExtractedJob {
  title: string
  company: string
  location: string
  description: string
  salary?: string
  requirements: string[]
  benefits: string[]
  postedAt?: Date
  confidence: number // How confident is the AI about this extraction
}

// Kimi-K2.6 denkt standardmäßig nach — Reasoning, das Nebius nicht als solches
// ausweist, aber als Output-Tokens abrechnet: gemessen 20s und 4.700 Output-
// Tokens für einen Ranking-Chunk, gegenüber 3s und 550 Tokens mit abgeschalte-
// tem Denken. Der Schalter ist das Moonshot-Template-Feld
// chat_template_kwargs.thinking:false. Das AI-SDK reicht es nicht durch
// (providerOptions deckt nur OpenAI-eigene Optionen ab; reasoning_effort:'none'
// drosselt bei Nebius nur auf 13s/2.600 Tokens), deshalb greift dieser Wrapper
// in den Request-Body ein. Er hängt nur am Scoring-Client (scoringChat) — das
// Hauptmodell (K3, Anschreiben etc.) behält sein Denken.
export function noThinkingFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    if (init?.method === 'POST' && typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body)
        body.chat_template_kwargs = { thinking: false }
        init = { ...init, body: JSON.stringify(body) }
      } catch {
        // kein JSON-Body — unverändert durchlassen
      }
    }
    return baseFetch(input, init)
  }
}

// Get AI client based on provider
export function getAIClient(provider: string, apiKey?: string, baseUrl?: string, opts?: { disableThinking?: boolean }) {
  if (provider === 'ollama') {
    return createOpenAI({
      baseURL: baseUrl || 'http://localhost:11434/v1',
      apiKey: 'ollama',
    })
  }

  if (provider === 'nebius') {
    return createOpenAI({
      baseURL: baseUrl || 'https://api.tokenfactory.nebius.com/v1',
      apiKey: apiKey || process.env.NEBIUS_API_KEY,
      ...(opts?.disableThinking ? { fetch: noThinkingFetch() } : {}),
    })
  }

  if (provider === 'gemini') {
    return createOpenAI({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      apiKey: apiKey || process.env.GEMINI_API_KEY,
    })
  }

  if (provider === 'openrouter') {
    return createOpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey || process.env.OPENROUTER_API_KEY,
    })
  }

  return createOpenAI({
    apiKey: apiKey || process.env.OPENAI_API_KEY,
  })
}

// Default model per provider
export function defaultModel(provider: string): string {
  if (provider === 'ollama') return 'llama3.2'
  if (provider === 'nebius') return NEBIUS_DEFAULT_MODEL
  if (provider === 'gemini') return 'gemini-2.0-flash'
  if (provider === 'openrouter') return 'openai/gpt-4o-mini'
  return 'gpt-4o-mini'
}

// Effektives Abort-Timeout eines Guard-Versuchs: der engere Wert aus Call-Timeout
// und Restbudget bis zur Gesamtfrist des Suchlaufs. null heißt: Frist verbraucht —
// der Versuch entfällt, statt einen sicher toten Call zu starten. (Sonst überstand
// ein kurz vor der Frist gestarteter Call die Frist um seine volle Guard-Zeit,
// die Scoring-Welle kehrte nie rechtzeitig zurück, und der Lauf starb am 60s-Kill,
// bevor das Teilergebnis gesendet war — Runtime-Log 14.09.)
export function attemptTimeoutMs(timeoutMs: number, deadline?: number, now: number = Date.now()): number | null {
  if (deadline === undefined) return timeoutMs
  const remainingMs = deadline - now
  return remainingMs > 0 ? Math.min(timeoutMs, remainingMs) : null
}

// KI-Calls können am Provider stillstehen: keine Antwort, kein Fehler — der Call
// hängt, bis die Runtime den ganzen Request killt (in Produktion beobachtet:
// 60-s-Timeout, derselbe Aufruf Sekunden später erfolgreich). abortSignal macht
// aus dem Stillstand einen echten Fehler; der frische zweite Request geht in
// der Praxis durch, also wird genau der automatisch gefahren. deadline (Epoch-ms)
// kappt jeden Versuch zusätzlich an der Gesamtfrist des Suchlaufs.
export async function generateTextGuarded(
  params: Parameters<typeof generateText>[0],
  timeoutMs = 25000,
  retries = 1,
  deadline?: number
): Promise<Awaited<ReturnType<typeof generateText>>> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    const timeout = attemptTimeoutMs(timeoutMs, deadline)
    if (timeout === null) {
      throw lastError ?? new Error('Zeitbudget verbraucht — KI-Call nicht mehr gestartet')
    }
    try {
      return await generateText({ ...params, abortSignal: AbortSignal.timeout(timeout) })
    } catch (error) {
      lastError = error
      console.error(`KI-Call nicht durchgelaufen (Versuch ${attempt + 1}/${retries + 1}):`, error)
    }
  }
  throw lastError
}

// Parse JSON from model output, tolerating markdown code fences and prose around it
export function parseJsonFromText(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/[{[][\s\S]*[}\]]/)
    if (!match) throw new Error('Kein JSON in der KI-Antwort gefunden')
    return JSON.parse(match[0])
  }
}

// AI-powered job extraction from unstructured HTML
export async function extractJobFromHTML(html: string, url: string, provider: string = 'nebius'): Promise<ExtractedJob | null> {
  const ai = getAIClient(provider)

  const prompt = `Du bist ein Job-Extraktions-Experte. Extrahiere strukturierte Job-Daten aus dieser unstrukturierten HTML/Text-Seite.

URL: ${url}

HTML/Text Content:
${html.substring(0, 10000)}

Gib zurück als JSON mit diesen Feldern:
{
  "title": "Job Titel",
  "company": "Firmenname",
  "location": "Standort",
  "description": "Vollständige Job-Beschreibung",
  "salary": "Gehalt (falls vorhanden, sonst null)",
  "requirements": ["Anforderung 1", "Anforderung 2"],
  "benefits": ["Benefit 1", "Benefit 2"],
  "postedAt": "Datum (falls vorhanden, sonst null)",
  "confidence": 0.95
}

Wenn kein Job gefunden wird, gib null zurück.`

  try {
    const { text } = await generateText({
      model: ai.chat(defaultModel(provider)),
      messages: [{ role: 'user', content: prompt }],
    })

    const content = text || '{}'
    const result = parseJsonFromText(content)

    if (result.confidence < 0.5) return null
    return result as ExtractedJob
  } catch (error) {
    console.error('AI extraction error:', error)
    return null
  }
}

// Der Ranking-Prompt bewertet Fähigkeiten, nicht Titel — dafür braucht er die
// Anzeige in der Tiefe: 800 Zeichen statt 200, die passenden Skills stehen oft
// tief in der Beschreibung. Kostet auf dem Scoring-Modell Cent-Bruchteile.
export function buildSemanticRankingPrompt(
  resume: string,
  searchQuery: string,
  availableJobs: SemanticJob[],
  preferences?: PreferenceProfile | null
): string {
  // Numbered summary — the model only returns indices, never URLs or platforms.
  // (Asking it for those fields would make it hallucinate them.)
  const jobsSummary = availableJobs.map((j, i) =>
    `[${i}] TITLE: ${j.title}\nCOMPANY: ${j.company}\nLOCATION: ${j.location}\nDESC: ${j.description.substring(0, 800)}`
  ).join('\n\n---\n\n')

  // Der Resume ist hier schon auf 1000 Zeichen gekappt — das Profil bekommt
  // eine harte Kompaktkappe, damit der Rangierer keinen zweiten Lebenslauf
  // vorgesetzt bekommt.
  const prefsBlock = preferences
    ? `PREFERENZEN DES NUTZERS (kurz):\n${condensePreferenceProfile(preferences, 500)}\nBeziehe sie in relevanceScore und matchReason ein.\n\n`
    : ''

  return `Du bist ein Karriere-Matching-Experte. Finde Jobs, die semantisch passen, auch wenn die Titel nicht genau übereinstimmen.

RESUME:
${resume.substring(0, 1000)}

SUCH-QUERY: ${searchQuery}

${prefsBlock}VERFÜGBARE JOBS (nummeriert):
${jobsSummary}

Gib zurück als JSON:
{
  "matches": [
    {
      "index": 0,
      "relevanceScore": 0.85,
      "matchReason": "Warum dieser Job passt — max. 1 Satz",
      "transferableSkills": ["Skill1", "Skill2"]
    }
  ],
  "fuzzyMatches": ["Alternative Suchbegriffe"]
}

"index" ist die Nummer des Jobs aus der Liste oben. Nur Jobs mit relevanceScore >= 0.6 aufnehmen.
Antworte kompakt: matchReason in max. 1 Satz, transferableSkills mit max. 3 Skills — die Antwortzeit entscheidet, ob das Ranking ins Zeitlimit passt.`
}

// Erkannte Werkstudent-/Praktikums-Stellen im semantischen Ranking abwerten:
// relevanceScore unter den Speicher-/High-Match-Schwellen (0.7 → nicht
// gespeichert), mit Begründungs-Präfix statt verworfen — derselbe Vertrag
// wie im scoreJob-Cap, nur auf der 0-1-Relevanz-Skala.
export function demoteEntryLevelSemanticMatch(job: SemanticJob): SemanticJob {
  const label = detectEntryLevelRole(job.title, job.description)
  if (!label) return job
  return {
    ...job,
    relevanceScore: Math.min(job.relevanceScore, 0.3),
    matchReason: `Abgewertet — „${label}" erkannt: ${job.matchReason}`,
  }
}

// Semantic job search - finds jobs that match even with different titles
export async function semanticJobSearch(
  resume: string,
  searchQuery: string,
  availableJobs: SemanticJob[],
  provider: string = 'nebius',
  model?: string,
  apiKey?: string,
  baseUrl?: string,
  preferences?: PreferenceProfile | null,
  deadline?: number
): Promise<SemanticSearchResult> {
  const prompt = buildSemanticRankingPrompt(resume, searchQuery, availableJobs, preferences)

  try {
    const { text } = await generateTextGuarded(
      {
        // Ranking ist eine strukturierte Index-Aufgabe — wie das Scoring auf dem
        // schnellen Modell. Das Hauptmodell hier kostete die erste Jobsuche den
        // Lauf: Es denkt minutenlang, der Request stirbt am 60s-Limit der Route
        // (504).
        model: scoringChat(provider, apiKey, baseUrl, model),
        messages: [{ role: 'user', content: prompt }],
      },
      // 30s, kein Retry: Der Lauf hat eine Gesamtfrist (Deadline der Route) —
      // ein Ranking-Retry würde sie fressen. Fällt der Chunk aus, liefert er
      // nichts; die anderen Chunks ranken weiter. deadline kappt zusätzlich
      // an der Gesamtfrist — ein kurz vor Fristablauf gestarteter Chunk stirbt
      // an der Frist, nicht an der vollen Guard-Zeit danach.
      30_000,
      0,
      deadline
    )

    const result = parseJsonFromText(text || '{}')
    const matches = (Array.isArray(result.matches) ? result.matches : []) as {
      index: number
      relevanceScore?: number
      matchReason?: string
      transferableSkills?: string[]
    }[]

    // Map model indices back to the real jobs — URLs/platforms come from the
    // scraped data, never from the model
    const jobs = matches
      .filter(m => Number.isInteger(m?.index) && m.index >= 0 && m.index < availableJobs.length)
      .map(m => ({
        ...availableJobs[m.index],
        relevanceScore: typeof m.relevanceScore === 'number' ? m.relevanceScore : 0,
        matchReason: typeof m.matchReason === 'string' ? m.matchReason : '',
        transferableSkills: Array.isArray(m.transferableSkills) ? m.transferableSkills : [],
      }))
      // Werkstudent-/Praktikums-Signale auch im Ranking abwerten: unter den
      // Speicher-Schwellen (0.7) und ans Ende sortiert, aber sichtbar.
      .map(demoteEntryLevelSemanticMatch)

    return {
      query: searchQuery,
      jobs,
      fuzzyMatches: Array.isArray(result.fuzzyMatches) ? result.fuzzyMatches : [],
    }
  } catch (error) {
    console.error('Semantic search error:', error)
    return { query: searchQuery, jobs: [], fuzzyMatches: [] }
  }
}

// Der Scoring-Prompt stellt den wiederholten Teil nach vorn: Anweisungen,
// Lebenslauf und Wertpräferenzen sind über die Jobs eines Nutzers identisch und
// bilden so einen Cache-Präfix (der Provider kann den billigen Satz nutzen),
// die wechselnde Anzeige steht hinten. Die Reihenfolge ist Kostenvertrag —
// nicht drehen, ohne den Test zu lesen.
export function buildScorePrompt(
  jobDescription: string,
  resume: string,
  minSalary?: number | null,
  preferences?: PreferenceProfile | null
): string {
  const salaryLine =
    typeof minSalary === 'number' && minSalary > 0
      ? `5. Gehaltsvorstellung: Der Nutzer sucht ab ${minSalary} — liegt das angegebene Gehalt darunter, wirkt das den Score senkend, ist aber nur ein Faktor neben den Skills.\n`
      : ''

  // Die Präferenzen stehen im Präfix (pro Nutzer konstant) und die Regelzeile
  // bewusst unnummeriert — eine „6." klaffte, sobald minSalary fehlt. Ohne
  // Profil bleibt der Prompt byte-identisch zur Zeit ohne dieses Feature.
  const prefsBlock = preferences
    ? `\nWERTPREFERENZEN AUS DEM PRÄFERENZ-GESPRÄCH (vom Nutzer bestätigt):\n${renderPreferenceBlock(preferences)}\n`
    : ''
  const prefsRule = preferences
    ? 'Die Wertpräferenzen oben gelten: Die Gewichtung des Nutzers („hoch“, „mittel“, „niedrig“) schlägt die Reihenfolge der Liste hier, und Punkte unter „Meidet“ senken den Score wie ein Gehalt unter der Vorstellung.\n'
    : ''

  return `Du bist ein Karriere-Experte. Du bewertest gleich EINEN Job auf einer Skala von 1-10 basierend auf dem unten mitgelieferten Resume.

Resume:
${resume}
${prefsBlock}
Berücksichtige dabei:
1. Direkte Skill-Matches
2. Transferable Skills (Skills die übertragbar sind)
3. Potenzial zur Einarbeitung (job ist vielleicht etwas höher, aber lernbar)
4. Kultur-Fit basierend auf Firmenbeschreibung (falls vorhanden)
${salaryLine}${prefsRule}
Gib für den unten stehenden Job zurück als JSON:
{
  "score": number (1-10),
  "reason": "Detaillierte Begründung in Deutsch. Warum passt der Job? Was fehlt? Was sind Transferable Skills?",
  "gaps": ["Fehlende Skill 1", "Fehlende Skill 2"],
  "strengths": ["Stärke 1", "Stärke 2", "Transferable Skill 1"]
}

Ein Score von 8+ bedeutet sehr guter Fit. 6-7 bedeutet guter Fit mit kleinen Lücken. 5 oder weniger bedeutet großer Gap.

Der zu bewertende Job:
${jobDescription}

Bewerte jetzt diesen Job wie oben beschrieben.`
}

// Scoring läuft auf eigenem, schnellem Modell: kleine strukturierte Aufgabe,
// aber häufig. K2.6 statt GLM-5.3-Flash, weil der GLM-Flash-Serving-Pool keine
// Antworten mehr liefert: Aus Vercel-Produktion hängt jeder Call bis zum Guard-
// Timeout (aus zwei Regionen belegt), lokal zuletzt ebenfalls — der Kimi-Pool
// antwortet denselben Call in Sekunden (Beweiskette: HANDOFF-KI-SUCHE.md).
// Die Denkpause von K2.6 schaltet scoringChat ab — sonst wartet jeder Call
// 15–20s auf unsichtbares Reasoning. Nur Nebius kennt diese ID; andere
// Provider behalten ihr Modell.
const NEBIUS_SCORING_MODEL = 'moonshotai/Kimi-K2.6'

export function scoringModel(provider: string, userModel?: string): string {
  return provider === 'nebius' ? NEBIUS_SCORING_MODEL : userModel || defaultModel(provider)
}

// Der eine Einstieg fürs schnelle Modell: Modell-ID und Denk-Abschaltung
// gehören zusammen — ein K2.6-Call ohne thinking:false wartet 15–20s auf die
// Denkpause. Gilt nur für Nebius; andere Provider bekommen ihr Modell ohne
// Eingriff in den Request.
export function scoringChat(provider: string, apiKey?: string, baseUrl?: string, userModel?: string) {
  const ai = getAIClient(provider, apiKey, baseUrl, { disableThinking: provider === 'nebius' })
  return ai.chat(scoringModel(provider, userModel))
}

// --- Erkennung von Werkstudenten-/Praktikums-Signalen -----------------------
// Kernversprechen der App: „breit suchen, aber passend zu den Kompetenzen
// jenseits von Labels". Eine Werkstudenten-Stelle, deren Skills perfekt matchen,
// ist genau so ein Label-Fehlgriff — sie bekam Score 9, obwohl der Nutzer eine
// Vollzeit-Festanstellung sucht. Solche Anzeigen werden deshalb nicht verworfen
// (der Nutzer soll im UI nachvollziehen können, was passiert ist, und sie ggf.
// manuell prüfen), sondern auf ENTRY_LEVEL_ROLE_MAX_SCORE gedeckelt — mit
// Begründung in `reason`, die landet in Job.scoreReason.
// Trainee ist hier bewusst MIT im Muster: Es ist oft eine echte
// Vollzeit-Einstiegsrolle — ein harter Filter würde sie falsch verwerfen. Da
// wir aber nur abwerten statt filtern, bleibt eine Trainee-Stelle sichtbar,
// rutscht nur ans Ende des Rankings. Sollte das Profil je eine
// Teilzeit-Präferenz bekommen, ist diese Stelle der einzige Knopf dafür.
const ENTRY_LEVEL_ROLE_MAX_SCORE = 3

// Titel-Signale: Wortgrenzen + Endungen, damit „Werkstudent (m/w/d)",
// „Praktikum (6 Monate)", „Praktikant:in" und „Working Student" alle erfasst
// werden. „intern" steht im Titel einer echten Anzeige praktisch nie als
// Adjektiv („Intern, Finance" ist ein Internship) — im Titel also erlaubt.
const ENTRY_ROLE_TITLE_PATTERN =
  /\b(?:werkstud(?:ent|ierende)[a-z]*|praktikum[a-z]*|praktikant[a-z]*|intern(?:ship)?s?|working[ -]student[a-z]*|trainee[a-z]*)\b/i

// Fließtext-Signale: hier darf „intern" NICHT frei stehen — „Sie koordinieren
// intern und extern" ist ein klassisches Falsch-Positiv. Deshalb nur
// „internship" plus ein Kontextwort in Laufnähe (max. 40 Zeichen), z. B.
// „Werkstudent (m/w/d)", „ein Praktikum ab sofort", „Praktikum (6 Monate)".
const ENTRY_ROLE_DESC_PATTERN =
  /\b(?:werkstud(?:ent|ierende)[a-z]*|praktikum[a-z]*|praktikant[a-z]*|internship|working[ -]student[a-z]*|trainee[a-z]*)\b(?=[\s\S]{0,40}?(?:\(|\[|m\/w\/d|m\/f\/d|f\/m\/d|gesucht|stelle|position|role|ab sofort|monat))/i

function entryLevelRoleLabel(matched: string): string {
  const t = matched.toLowerCase()
  if (t.includes('praktik')) return 'Praktikum'
  if (t.startsWith('werkstud') || t.includes('working')) return 'Werkstudenten-Stelle'
  if (t.includes('trainee')) return 'Trainee-Stelle'
  return 'Internship'
}

// Erkannte Einstiegs-/Nebenjob-Signale als lesbare Kategorie — null heißt:
// keine Signale, die Bewertung bleibt unverändert. Rein deterministisch,
// damit getestet werden kann, ohne die KI zu brauchen.
export function detectEntryLevelRole(title: string, description?: string | null): string | null {
  const titleMatch = title?.match(ENTRY_ROLE_TITLE_PATTERN)
  if (titleMatch) return entryLevelRoleLabel(titleMatch[0])
  const descMatch = description?.match(ENTRY_ROLE_DESC_PATTERN)
  if (descMatch) return entryLevelRoleLabel(descMatch[0])
  return null
}

// Der gedeckelte Score für eine erkannte Werkstudenten-/Praktikums-Stelle.
// Bewusst ohne KI-Call: die Antwort ist deterministisch und spart der breiten
// Suche einen LLM-Call pro erkannter Stelle. strengths/gaps bleiben leer —
// die Begründung steht komplett in `reason`.
export function entryLevelRoleVerdict(title: string, description?: string | null): ScoreResult | null {
  const label = detectEntryLevelRole(title, description)
  if (!label) return null
  return {
    score: ENTRY_LEVEL_ROLE_MAX_SCORE,
    reason:
      `Stark abgewertet (Score gedeckelt bei ${ENTRY_LEVEL_ROLE_MAX_SCORE}): „${label}" in Titel oder Anzeige erkannt. ` +
      'Der Nutzer sucht eine Vollzeit-Festanstellung — Werkstudenten-Stellen, Praktika und Internships passen nicht zum Zielprofil, ' +
      'auch wenn die Skills matchen. Bewusst nur abgewertet statt verworfen — im Zweifel manuell prüfen.',
    gaps: [],
    strengths: [],
  }
}

// Score job against resume (enhanced with transferable skills)
// minSalary: Wunscheinstellung aus den Settings — als Kontext in die Bewertung,
// damit die gespeicherte Einstellung eine Wirkung hat statt nur zu existieren.
// preferences: Profil aus dem Präferenz-Gespräch (UserSettings.preferenceProfile).
// jobTitle: nötig für die Werkstudent-/Praktikums-Erkennung — die Beschreibung
// allein trägt den Signal-Titel oft nicht (Score-Vertrag bleibt unverändert,
// solange kein Titel übergeben wird).
export async function scoreJob(
  jobDescription: string,
  resume: string,
  provider: string = 'nebius',
  model?: string,
  apiKey?: string,
  baseUrl?: string,
  minSalary?: number | null,
  preferences?: PreferenceProfile | null,
  deadline?: number,
  jobTitle?: string
): Promise<ScoreResult> {
  // Eligibility vor dem LLM-Call: erkannte Werkstudenten-/Praktikums-Stellen
  // bekommen den gedeckelten Score mit Begründung — ohne KI-Call.
  const eligibilityVerdict = entryLevelRoleVerdict(jobTitle ?? '', jobDescription)
  if (eligibilityVerdict) return eligibilityVerdict

  const prompt = buildScorePrompt(jobDescription, resume, minSalary, preferences)

  try {
    // Auch das Scoring bewaffnet: 50 parallele Calls erhöhen die Treffer-
    // wahrscheinlichkeit des Provider-Stalls — ein gehängter Call würde die
    // ganze Scoring-Welle (und damit den Suchlauf) bis zum Kill aufhalten.
    // deadline kappt jeden Versuch an der Gesamtfrist der Suche (25s Guard,
    // 1 Retry — nur noch, solange Restbudget da ist).
    const { text } = await generateTextGuarded(
      {
        model: scoringChat(provider, apiKey, baseUrl, model),
        messages: [{ role: 'user', content: prompt }],
      },
      25_000,
      1,
      deadline
    )

    const content = text || '{}'
    const result = parseJsonFromText(content) as ScoreResult
    if (typeof result.score !== 'number') {
      throw new Error('KI-Antwort ohne numerischen Score')
    }
    return result
  } catch (error) {
    console.error('AI scoring error:', error)
    return {
      score: null,
      reason: 'KI nicht erreichbar — Job konnte nicht bewertet werden',
      gaps: [],
      strengths: [],
    }
  }
}

// Prompt-Bau als eigene Funktion (Muster: buildCoverLetterPrompt) — der
// Vertrag über die Präferenz-Beimischung ist getestet. Keine Negationen in den
// Queries: Jobbörsen-APIs können nicht negieren, „kein Bereitschaftsdienst"
// verbrennt nur einen der 5–10 Slots.
export function buildSearchQueryPrompt(
  resume: string,
  originalQuery: string,
  preferences?: PreferenceProfile | null
): string {
  const prefsBlock = preferences
    ? `\nPRÄFERENZEN DES NUTZERS:\n${condensePreferenceProfile(preferences, 300)}\nNeige die Begriffe zu den gewünschten Rollen und Schwerpunkten. Keine Negationen („kein X" ist als Suchbegriff nutzlos).\n`
    : ''

  return `Basierend auf diesem Resume und der ursprünglichen Suchanfrage, generiere 5-10 alternative Suchbegriffe, die Jobs finden könnten, die passen aber vielleicht andere Titel haben.

RESUME:
${resume.substring(0, 800)}

URSPRÜNGLICHE QUERY: ${originalQuery}
${prefsBlock}
Gib zurück als JSON:
{
  "queries": ["Alternative Query 1", "Query 2", ...]
}

Berücksichtige:
- Synonyme für Job-Titel
- Verwandte Rollen
- Industry-spezifische Titel
- Seniority-Level Variationen`
}

// Generate alternative search queries for edge cases
export async function generateSearchQueries(
  resume: string,
  originalQuery: string,
  provider: string = 'nebius',
  preferences?: PreferenceProfile | null,
  apiKey?: string,
  baseUrl?: string
): Promise<string[]> {
  const prompt = buildSearchQueryPrompt(resume, originalQuery, preferences)

  try {
    // Query-Fächer laufen VOR jedem Fortschritts-Event der Suche — hängt hier
    // das Standard-Modell (K3 denkt auf offenen Prompts minutenlang), stirbt
    // der ganze Lauf am 60s-Limit, bevor die Suche überhaupt begonnen hat.
    // Kleine strukturierte Aufgabe → schnelles Scoring-Modell + Guard; fällt
    // es trotzdem aus, fängt die Route das ab (nur die Original-Query).
    const { text } = await generateTextGuarded(
      {
        model: scoringChat(provider, apiKey, baseUrl),
        messages: [{ role: 'user', content: prompt }],
      },
      // Enger bemessen als der Guard-Standard, kein Retry: Der Fächer ist
      // Bonus — 2×25s Worst Case haben einmal das ganze 60s-Budget der Suche
      // verbraucht, bevor sie beginnt (Runtime-Log 13.09.). Fällt er aus,
      // läuft die Suche mit der Original-Query weiter.
      10_000,
      0
    )

    const content = text || '{}'
    const result = parseJsonFromText(content)
    return result.queries || []
  } catch {
    return []
  }
}

// Generate tailored resume for job
export async function tailorResume(
  resume: string,
  jobDescription: string,
  provider: string = 'nebius',
  model?: string
): Promise<string> {
  const ai = getAIClient(provider)

  const prompt = `Passe dieses Resume an die Job-Beschreibung an. Betone relevante Erfahrungen und Skills. Erfinde nichts.

Original Resume:
${resume}

Job-Beschreibung:
${jobDescription}

Gib das angepasste Resume als Markdown zurück.

Fokus auf:
1. Relevante Erfahrung hervorheben
2. Transferable Skills betonen
3. Keywords aus Job-Description einbauen
4. Quantifizierbare Ergebnisse behoben`

  try {
    const { text } = await generateText({
      model: ai.chat(model || defaultModel(provider)),
      messages: [{ role: 'user', content: prompt }],
    })

    return text || resume
  } catch {
    return resume
  }
}

// Prompt-Bau als eigene Funktion: Das Anschreiben soll die Sprache UND den Ton
// der Anzeige treffen — der Vertrag darüber ist getestet (tests/lib/ai.test.ts).
export function buildCoverLetterPrompt(
  resume: string,
  jobDescription: string,
  company: string,
  jobTitle?: string,
  language: 'de' | 'en' = 'de',
  anecdoteBlock?: string
): string {
  const languageRules =
    language === 'en'
      ? `Sprache: Die Stellenanzeige ist auf Englisch — schreibe das komplette
Anschreiben auf Englisch, unabhängig von der Sprache des Lebenslaufs. Übernimm
Tonalität und Schreibstil der Anzeige und benutze ihre Begrifflichkeiten.
Beginne mit einer Anrede („Dear Hiring Team,“ oder konkreter, falls ein
Ansprechpartner erkennbar ist) und schließe mit „Sincerely,“ oder „Best regards,.`
      : `Sprache: Schreibe das Anschreiben auf Deutsch. Übernimm die Ansprache der
Anzeige — steht sie in der Du-Form („Dein Profil“), schreibe das Anschreiben
konsequent in der Du-Form, steht sie in der Sie-Form, in der Sie-Form. Orientiere
dich außerdem am Wortschatz und Schreibstil der Anzeige: benutze die
Begrifflichkeiten und Fachbegriffe, die die Anzeige selbst verwendet, und passe
die Tonalität an (seriös-knackig bei lockerer Anzeige, förmlich bei förmlicher).
Beginne mit einer Anrede („Sehr geehrte Damen und Herren,“ oder konkreter, falls
ein Ansprechpartner erkennbar ist; in der Du-Form z. B. „Hallo Frau Schmidt,“)
und schließe mit „Mit freundlichen Grüßen“.`

  return `Schreibe ein professionelles Anschreiben für:

Firma: ${company}
Stelle: ${jobTitle || 'wie ausgeschrieben'}
Job-Beschreibung: ${jobDescription}

Basierend auf diesem Lebenslauf:
${resume}

${languageRules}
${anecdoteBlock ? `\n${anecdoteBlock}\n\nBeachte: Strukturpunkt 1 (Einleitung) ist damit die Anekdote selbst — kein generischer Motivationssatz.\n` : ''}
Halte es kurz (3-4 Absätze), professionell und überzeugend. Beziehe dich konkret
auf Anforderungen aus der Stellenbeschreibung und Stärken aus dem Lebenslauf —
keine Floskeln ohne Bezug.

Struktur:
1. Einleitung: Warum ich mich bewerbe
2. Meine relevante Skills und Erfahrungen (aus dem Lebenslauf belegt)
3. Warum ich zur Firma passe
4. Abschluss`
}

// Übersetzungs-Prompt für Lebensläufe: strikte Übersetzung, keine inhaltliche
// Freiheit — jeder Fakt, jede Zahl, jede Firma bleibt exakt erhalten.
export function buildTranslateResumePrompt(content: string, targetLang: 'de' | 'en'): string {
  const target = targetLang === 'en' ? 'Englische' : 'Deutsche'
  return `Übersetze den folgenden Lebenslauf ${targetLang === 'en' ? 'ins Englische' : 'ins Deutsche'}. ${target} Übersetzung, strikt:

- Übersetze jeden Satz vollständig — keine Kürzungen, keine Zusammenfassungen.
- Erfinde nichts und ergänze nichts: Kein Satz, keine Zahl, kein Datum, kein
  Firmenname darf hinzukommen oder sich ändern. Namen von Personen und Firmen
  sowie Produkt- und Technologienamen bleiben unverändert.
- Behalte die Zeilenstruktur exakt bei (Überschriften bleiben Überschriften,
  Listenpunkte Listenpunkte, Einrückungen Einrückungen).
- Gib AUSSCHLIESSLICH die Übersetzung aus — kein Vorwort, keine Anmerkungen.

Lebenslauf:
${content}`
}

// Lebenslauf übersetzen (Download in der Sprache der Anzeige). Wirft bei
// KI-Ausfall — die Route antwortet ehrlich mit einem Fehler, statt ein Dokument
// in der falschen Sprache auszuliefern.
export async function translateResume(
  content: string,
  targetLang: 'de' | 'en',
  provider: string = 'nebius',
  model?: string,
  apiKey?: string,
  baseUrl?: string
): Promise<string> {
  const ai = getAIClient(provider, apiKey, baseUrl)

  const { text } = await generateText({
    model: ai.chat(model || defaultModel(provider)),
    messages: [{ role: 'user', content: buildTranslateResumePrompt(content, targetLang) }],
  })

  if (!text || text.trim().length === 0) {
    throw new Error('Die KI hat keine Übersetzung geliefert')
  }
  return text.trim()
}

// Generate cover letter.
// Wirft bei KI-Ausfall — der Aufrufer entscheidet über den ehrlichen Fallback
// (Vorlage mit „bitte prüfen“-Hinweis), statt still eine leere Antwort zu liefern.
export async function generateCoverLetter(
  resume: string,
  jobDescription: string,
  company: string,
  provider: string = 'nebius',
  model?: string,
  apiKey?: string,
  baseUrl?: string,
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

  const { text } = await generateText({
    model: ai.chat(model || defaultModel(provider)),
    messages: [{ role: 'user', content: prompt }],
  })

  if (!text || text.trim().length === 0) {
    throw new Error('Die KI hat kein Anschreiben geliefert')
  }
  return text.trim()
}

// Provider-Konfiguration aus den Nutzer-Settings — eine Stelle für die Zuordnung
// „welcher Key gehört zu welchem Provider“, statt derselben Ternärkette in jeder Route.
interface AIConfigSource {
  aiProvider?: string | null
  aiModel?: string | null
  nebiusApiKey?: string | null
  geminiApiKey?: string | null
  openaiApiKey?: string | null
  openrouterApiKey?: string | null
  ollamaUrl?: string | null
}

export function aiConfigFromSettings(settings: AIConfigSource | null | undefined): {
  provider: string
  model?: string
  apiKey?: string
  baseUrl?: string
} {
  const provider = settings?.aiProvider || 'nebius'
  return {
    provider,
    model: settings?.aiModel || undefined,
    apiKey:
      provider === 'nebius'
        ? settings?.nebiusApiKey || undefined
        : provider === 'gemini'
          ? settings?.geminiApiKey || undefined
          : provider === 'openai'
            ? settings?.openaiApiKey || undefined
            : provider === 'openrouter'
              ? settings?.openrouterApiKey || undefined
              : undefined,
    baseUrl: provider === 'ollama' ? settings?.ollamaUrl || undefined : undefined,
  }
}

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
