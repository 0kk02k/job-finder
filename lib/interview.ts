// Geführtes HR-Interview: Der strukturierte Leitfaden ist die Agenda im Hintergrund,
// die Konversation selbst ist ein freier, interaktiver Chat. Einzelne Leitfaden-Punkte
// werden abgehakt, sobald sie befriedigend beantwortet wurden (strukturierte Interviews
// haben laut Schmidt & Hunter 1998 deutlich höhere Validität als unstrukturierte —
// die Struktur steckt deshalb in der Checkliste, nicht im Gesprächsfluss).

import { generateText } from 'ai'
import { getAIClient, defaultModel, parseJsonFromText } from './ai'

export interface InterviewMessage {
  role: 'assistant' | 'user'
  content: string
  ts: string
}

export interface InterviewInsights {
  strengths: { name: string; starExample: string }[]
  weaknesses: { name: string; mitigation: string }[]
  miniTask: {
    task: string
    answer: string
    assessment: string
    scores: { correctness: number; reasoning: number; completeness: number }
  } | null
  competencies: Record<string, number>
  summary: string
}

export interface GuideItem {
  id: string
  category: string
  topic: string
  criteria: string // wann gilt der Punkt als befriedigend beantwortet
}

export const INTERVIEW_GUIDE: GuideItem[] = [
  {
    id: 'background',
    category: 'Kennenlernen',
    topic: 'Werdegang & aktuelle Rolle',
    criteria: 'Beruflicher Hintergrund, aktuelle Rolle und Schwerpunkt sind klar.',
  },
  {
    id: 'motivation-change',
    category: 'Kennenlernen',
    topic: 'Antrieb & Wechselmotivation',
    criteria: 'Es ist klar, warum der Kandidat sucht und was ihn antreibt.',
  },
  {
    id: 'strength-1',
    category: 'Stärken',
    topic: 'Stärke 1 mit STAR-Beispiel',
    criteria: 'Eine konkrete Stärke mit vollständigem Beispiel: Situation, eigene Aufgabe, konkrete Aktion, Ergebnis (ideal quantifiziert).',
  },
  {
    id: 'strength-2',
    category: 'Stärken',
    topic: 'Stärke 2 mit STAR-Beispiel',
    criteria: 'Eine zweite, andere Stärke mit vollständigem STAR-Beispiel.',
  },
  {
    id: 'weakness-1',
    category: 'Schwächen',
    topic: 'Echte Schwäche mit Beispiel',
    criteria: 'Eine echte Schwäche (keine Floskel wie "Perfektionismus") mit konkretem Beispiel, wo sie zuletzt hinderlich war.',
  },
  {
    id: 'weakness-mitigation',
    category: 'Schwächen',
    topic: 'Gegenmaßnahme zur Schwäche',
    criteria: 'Klar, was der Kandidat aktiv gegen die Schwäche tut und welcher Fortschritt sichtbar ist.',
  },
  {
    id: 'teamwork-conflict',
    category: 'Verhalten & Team',
    topic: 'Konflikt/Widerstand im Team',
    criteria: 'Eine Teamsituation mit Konflikt oder Widerstand, erzählt nach STAR, inkl. eigener Rolle und Ausgang.',
  },
  {
    id: 'pressure-priorities',
    category: 'Verhalten & Team',
    topic: 'Umgang mit Druck & Priorisierung',
    criteria: 'Eine Situation unter Zeitdruck mit nachvollziehbarer Priorisierung und Ergebnis.',
  },
  {
    id: 'mini-task',
    category: 'Praxisaufgabe',
    topic: 'Mini-Aufgabe (Arbeitsprobe)',
    criteria: 'Aufgabe gestellt, Antwort erhalten, kurzes ehrliches Feedback gegeben.',
  },
  {
    id: 'goals-next-role',
    category: 'Abschluss',
    topic: 'Ziele für die nächste Rolle',
    criteria: 'Klar, was der nächste Job mitbringen muss (Aufgaben, Umfeld, Entwicklung).',
  },
]

export const OPENING_MESSAGE = `Hallo! Schön, dass du da bist. Ich führe dich jetzt durch ein Interview — ähnlich wie ein echtes HR-Gespräch, aber ganz entspannt als Chat. Im Hintergrund habe ich eine Agenda: Ich möchte deine Stärken und Schwächen mit konkreten Beispielen verstehen, erfahren, wie du im Team arbeitest, dir eine kleine Praxisaufgabe stellen und zum Schluss über deine Ziele sprechen.

Du kannst jederzeit Fragen stellen, Abschweifungen sind okay — wir kommen schon durch alles durch. Und du kannst pausieren, wann du willst.

Dann legen wir los: **Erzähl mir kurz von dir — wer bist du beruflich, und was machst du aktuell?**`

const MINI_TASK_CATALOG = `Wenn du die Mini-Aufgabe stellst, wähle EINE passend zum Profil des Kandidaten:
- Code-Review: ein ~15-zeiliger Code-Schnipsel mit 2 absichtlichen Fehlern, den der Kandidat kommentieren soll
- Kommunikation: "Erkläre einem Nicht-Techniker [Konzept aus seinem Bereich] in 5 Sätzen"
- Priorisierung: 5 fiktive Tickets/Bugs, die priorisiert und begründet werden sollen
Bewerte die Antwort nach Korrektheit, Begründungsqualität und Vollständigkeit und gib kurzes, ehrliches Feedback.`

interface AIConfig {
  provider?: string
  model?: string
  apiKey?: string
  baseUrl?: string
}

// Nächster Interviewer-Zug im freien Gespräch. Die KI bekommt die Agenda mit
// abgehakten/offenen Punkten und meldet zurück, welche Punkte durch die letzte
// Antwort des Kandidaten (oder kumuliert über den Verlauf) abgehakt werden können.
export async function interviewerReply(
  messages: InterviewMessage[],
  completedIds: string[],
  resumeContent: string | null,
  config: AIConfig
): Promise<{ reply: string; completed: string[] }> {
  const ai = getAIClient(config.provider || 'mistral', config.apiKey, config.baseUrl)

  const history = messages
    .map((m) => `${m.role === 'assistant' ? 'INTERVIEWER' : 'KANDIDAT'}: ${m.content}`)
    .join('\n\n')

  const agenda = INTERVIEW_GUIDE.map((item) => {
    const done = completedIds.includes(item.id)
    return `${done ? '[x]' : '[ ]'} ${item.id} (${item.category}: ${item.topic})\n    Abhak-Kriterium: ${item.criteria}`
  }).join('\n')

  const remaining = INTERVIEW_GUIDE.filter((i) => !completedIds.includes(i.id))

  const prompt = `Du bist eine erfahrene, warme HR-Interviewerin und führst ein Interview als natürlichen, interaktiven Chat auf Deutsch. Es ist ein GESPRÄCH, kein Fragebogen: Du hörst zu, greifst Punkte auf, schweifst kurz mit, beantwortest Rückfragen — und führst die Unterhaltung dabei organisch durch deine Agenda.

DEINE AGENDA (abgehakt = [x], offen = [ ]):
${agenda}

${resumeContent ? `LEBENSLAUF DES KANDIDATEN (Kontext):\n${resumeContent.substring(0, 1500)}\n` : ''}
BISHERIGER VERLAUF:
${history || '(noch leer)'}

REGELN:
- Freie Gesprächsführung: Die Reihenfolge der offenen Punkte ist dir überlassen; schließe an, was der Kandidat gerade erzählt.
- Ein Punkt gilt als abgehakt, wenn sein Kriterium über den GESAMTEN Verlauf hinweg erfüllt ist — auch wenn die Antwort über mehrere Nachrichten verteilt kam oder beiläufig fiel.
- Bei oberflächlichen Antworten: freundlich nachfassen ("Was war genau DEIN Beitrag?", "Woran hat man das Ergebnis gemerkt?"), statt den Punkt abzuhaken.
- Maximal 1–2 Fragen pro Nachricht. Würdige Antworten kurz, bevor du weiterfragst.
- Die Mini-Aufgabe (Praxisaufgabe) stellst du, wenn es passt — frühestens, wenn Stärken und Schwächen abgehakt sind. ${MINI_TASK_CATALOG}
- Duzen, lockerer aber professioneller Ton.
- Sind alle Punkte abgehakt, verabschiede dich mit einer kurzen, ehrlichen Zusammenfassung.

Antworte AUSSCHLIESSLICH als JSON:
{
  "reply": "Deine nächste Nachricht an den Kandidaten",
  "completed": ["id1", "id2"]
}
"completed" enthält NUR IDs von Punkten aus der Agenda, die jetzt (kumulativ) erfüllt sind — leer, wenn keiner dazukam. Verbleibende offene Punkte: ${remaining.map((i) => i.id).join(', ') || 'keine'}.`

  const { text } = await generateText({
    model: ai.chat(config.model || defaultModel(config.provider || 'mistral')),
    messages: [{ role: 'user', content: prompt }],
  })

  const result = parseJsonFromText(text || '{}')
  const validIds = new Set(INTERVIEW_GUIDE.map((i) => i.id))
  const completed = (Array.isArray(result.completed) ? result.completed : [])
    .filter((id: unknown) => typeof id === 'string' && validIds.has(id) && !completedIds.includes(id))

  return {
    reply: typeof result.reply === 'string' && result.reply.trim() ? result.reply : 'Kannst du das noch etwas genauer beschreiben?',
    completed,
  }
}

// Abschluss: strukturierte Insights aus dem kompletten Transkript erzeugen
export async function generateInsights(
  messages: InterviewMessage[],
  config: AIConfig
): Promise<InterviewInsights | null> {
  const ai = getAIClient(config.provider || 'mistral', config.apiKey, config.baseUrl)

  const transcript = messages
    .map((m) => `${m.role === 'assistant' ? 'INTERVIEWER' : 'KANDIDAT'}: ${m.content}`)
    .join('\n\n')

  const prompt = `Du bist HR-Analystin. Werte dieses Interview-Transkript aus und erstelle eine strukturierte Kandidaten-Akte auf Deutsch.

TRANSKRIPT:
${transcript}

Gib zurück als JSON:
{
  "strengths": [{ "name": "Stärke", "starExample": "Das im Interview genannte STAR-Beispiel, kurz zusammengefasst" }],
  "weaknesses": [{ "name": "Schwäche", "mitigation": "Was der Kandidat dagegen tut" }],
  "miniTask": {
    "task": "Gestellte Aufgabe",
    "answer": "Antwort des Kandidaten, kurz",
    "assessment": "Bewertung: was war gut, was fehlte",
    "scores": { "correctness": 1-5, "reasoning": 1-5, "completeness": 1-5 }
  },
  "competencies": { "teamwork": 1-5, "communication": 1-5, "problemSolving": 1-5, "selfReflection": 1-5 },
  "summary": "Gesamteindruck in 2-3 Sätzen"
}

Nur aus dem Transkript belegte Aussagen verwenden, nichts erfinden. Wurde keine Mini-Aufgabe gestellt, "miniTask": null.`

  try {
    const { text } = await generateText({
      model: ai.chat(config.model || defaultModel(config.provider || 'mistral')),
      messages: [{ role: 'user', content: prompt }],
    })
    const result = parseJsonFromText(text || '{}')
    return {
      strengths: Array.isArray(result.strengths) ? result.strengths : [],
      weaknesses: Array.isArray(result.weaknesses) ? result.weaknesses : [],
      miniTask: result.miniTask ?? null,
      competencies: result.competencies ?? {},
      summary: typeof result.summary === 'string' ? result.summary : '',
    }
  } catch (error) {
    console.error('Insights generation error:', error)
    return null
  }
}
