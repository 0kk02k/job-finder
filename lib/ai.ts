// AI integration for job scoring, resume matching, and intelligent job extraction
// Supports: Ollama (local), Gemini (cloud), OpenRouter (multi-provider)

import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

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

  if (provider === 'mistral') {
    return createOpenAI({
      baseURL: 'https://api.mistral.ai/v1',
      apiKey: apiKey || process.env.MISTRAL_API_KEY,
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
  if (provider === 'mistral') return 'mistral-small-latest'
  if (provider === 'gemini') return 'gemini-2.0-flash'
  if (provider === 'openrouter') return 'openai/gpt-4o-mini'
  return 'gpt-4o-mini'
}

// Parse JSON from model output, tolerating markdown code fences and prose around it
function parseJsonFromText(text: string) {
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
export async function extractJobFromHTML(html: string, url: string, provider: string = 'mistral'): Promise<ExtractedJob | null> {
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
      model: ai(defaultModel(provider)),
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
  provider: string = 'mistral',
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
      model: ai(model || defaultModel(provider)),
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

// Score job against resume (enhanced with transferable skills)
export async function scoreJob(
  jobDescription: string,
  resume: string,
  provider: string = 'mistral',
  model?: string,
  apiKey?: string,
  baseUrl?: string
): Promise<ScoreResult> {
  const ai = getAIClient(provider, apiKey, baseUrl)

  const prompt = `Du bist ein Karriere-Experte. Bewerte diesen Job auf einer Skala von 1-10 basierend auf dem Resume.

Job-Beschreibung:
${jobDescription}

Resume:
${resume}

Berücksichtige dabei:
1. Direkte Skill-Matches
2. Transferable Skills (Skills die übertragbar sind)
3. Potenzial zur Einarbeitung (job ist vielleicht etwas höher, aber lernbar)
4. Kultur-Fit basierend auf Firmenbeschreibung (falls vorhanden)

Gib zurück als JSON:
{
  "score": number (1-10),
  "reason": "Detaillierte Begründung in Deutsch. Warum passt der Job? Was fehlt? Was sind Transferable Skills?",
  "gaps": ["Fehlende Skill 1", "Fehlende Skill 2"],
  "strengths": ["Stärke 1", "Stärke 2", "Transferable Skill 1"]
}

Ein Score von 8+ bedeutet sehr guter Fit. 6-7 bedeutet guter Fit mit kleinen Lücken. 5 oder weniger bedeutet großer Gap.`

  try {
    const { text } = await generateText({
      model: ai(model || (defaultModel(provider))),
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
  provider: string = 'mistral'
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
      model: ai(defaultModel(provider)),
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
  provider: string = 'mistral',
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
      model: ai(model || defaultModel(provider)),
      messages: [{ role: 'user', content: prompt }],
    })

    return text || resume
  } catch {
    return resume
  }
}

// Generate cover letter
export async function generateCoverLetter(
  resume: string,
  jobDescription: string,
  company: string,
  provider: string = 'mistral'
): Promise<string> {
  const ai = getAIClient(provider)

  const prompt = `Schreibe ein professionelles Anschreiben auf Deutsch für:

Firma: ${company}
Job-Beschreibung: ${jobDescription}

Basierend auf diesem Resume:
${resume}

Halte es kurz (3-4 Absätze), professionell und überzeugend.

Struktur:
1. Einleitung: Warum ich mich bewerbe
2. Meine relevanten Skills und Erfahrungen
3. Warum ich zur Firma passe
4. Abschluss`

  try {
    const { text } = await generateText({
      model: ai(defaultModel(provider)),
      messages: [{ role: 'user', content: prompt }],
    })

    return text || ''
  } catch {
    return ''
  }
}
