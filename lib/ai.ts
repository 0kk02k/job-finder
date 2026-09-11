// AI integration for job scoring, resume matching, and intelligent job extraction
// Supports: Nebius Token Factory (Default, Kimi K2.5), Ollama (local), Gemini, OpenRouter

import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import {
  AnecdoteInput,
  buildExtractPrompt,
  buildMatchPrompt,
  parseJsonLoose,
} from './anecdotes'

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

// Get AI client based on provider
export function getAIClient(provider: string, apiKey?: string, baseUrl?: string) {
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

// Semantic job search - finds jobs that match even with different titles
export async function semanticJobSearch(
  resume: string,
  searchQuery: string,
  availableJobs: SemanticJob[],
  provider: string = 'nebius',
  model?: string,
  apiKey?: string,
  baseUrl?: string
): Promise<SemanticSearchResult> {
  const ai = getAIClient(provider, apiKey, baseUrl)

  // Numbered summary — the model only returns indices, never URLs or platforms.
  // (Asking it for those fields would make it hallucinate them.)
  const jobsSummary = availableJobs.map((j, i) =>
    `[${i}] TITLE: ${j.title}\nCOMPANY: ${j.company}\nLOCATION: ${j.location}\nDESC: ${j.description.substring(0, 200)}`
  ).join('\n\n---\n\n')

  const prompt = `Du bist ein Karriere-Matching-Experte. Finde Jobs, die semantisch passen, auch wenn die Titel nicht genau übereinstimmen.

RESUME:
${resume.substring(0, 1000)}

SUCH-QUERY: ${searchQuery}

VERFÜGBARE JOBS (nummeriert):
${jobsSummary}

Gib zurück als JSON:
{
  "matches": [
    {
      "index": 0,
      "relevanceScore": 0.85,
      "matchReason": "Warum dieser Job passt (Transferable Skills, Industrie, etc.)",
      "transferableSkills": ["Skill1", "Skill2"]
    }
  ],
  "fuzzyMatches": ["Alternative Suchbegriffe"]
}

"index" ist die Nummer des Jobs aus der Liste oben. Nur Jobs mit relevanceScore >= 0.6 aufnehmen.`

  try {
    const { text } = await generateText({
      model: ai.chat(model || defaultModel(provider)),
      messages: [{ role: 'user', content: prompt }],
    })

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

// Der Scoring-Prompt stellt den wiederholten Teil nach vorn: Anweisungen und
// Lebenslauf sind über alle Aufrufe identisch und bilden so einen Cache-Präfix
// (der Provider kann den billigen Satz nutzen), die wechselnde Anzeige steht
// hinten. Die Reihenfolge ist Kostenvertrag — nicht drehen, ohne den Test zu lesen.
export function buildScorePrompt(
  jobDescription: string,
  resume: string,
  minSalary?: number | null
): string {
  const salaryLine =
    typeof minSalary === 'number' && minSalary > 0
      ? `5. Gehaltsvorstellung: Der Nutzer sucht ab ${minSalary} — liegt das angegebene Gehalt darunter, wirkt das den Score senkend, ist aber nur ein Faktor neben den Skills.\n`
      : ''

  return `Du bist ein Karriere-Experte. Du bewertest gleich EINEN Job auf einer Skala von 1-10 basierend auf dem unten mitgelieferten Resume.

Resume:
${resume}

Berücksichtige dabei:
1. Direkte Skill-Matches
2. Transferable Skills (Skills die übertragbar sind)
3. Potenzial zur Einarbeitung (job ist vielleicht etwas höher, aber lernbar)
4. Kultur-Fit basierend auf Firmenbeschreibung (falls vorhanden)
${salaryLine}
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

// Score job against resume (enhanced with transferable skills)
// minSalary: Wunscheinstellung aus den Settings — als Kontext in die Bewertung,
// damit die gespeicherte Einstellung eine Wirkung hat statt nur zu existieren.
export async function scoreJob(
  jobDescription: string,
  resume: string,
  provider: string = 'nebius',
  model?: string,
  apiKey?: string,
  baseUrl?: string,
  minSalary?: number | null
): Promise<ScoreResult> {
  const ai = getAIClient(provider, apiKey, baseUrl)

  const prompt = buildScorePrompt(jobDescription, resume, minSalary)

  try {
    const { text } = await generateText({
      model: ai.chat(model || (defaultModel(provider))),
      messages: [{ role: 'user', content: prompt }],
    })

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

// Generate alternative search queries for edge cases
export async function generateSearchQueries(
  resume: string,
  originalQuery: string,
  provider: string = 'nebius'
): Promise<string[]> {
  const ai = getAIClient(provider)

  const prompt = `Basierend auf diesem Resume und der ursprünglichen Suchanfrage, generiere 5-10 alternative Suchbegriffe, die Jobs finden könnten, die passen aber vielleicht andere Titel haben.

RESUME:
${resume.substring(0, 800)}

URSPRÜNGLICHE QUERY: ${originalQuery}

Gib zurück als JSON:
{
  "queries": ["Alternative Query 1", "Query 2", ...]
}

Berücksichtige:
- Synonyme für Job-Titel
- Verwandte Rollen
- Industry-spezifische Titel
- Seniority-Level Variationen`

  try {
    const { text } = await generateText({
      model: ai.chat(defaultModel(provider)),
      messages: [{ role: 'user', content: prompt }],
    })

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
