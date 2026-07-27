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

// Nächster Interviewer-Zug im freien Gespräch. Läuft in zwei getrennten KI-Calls:
// 1. Abhaken der Agenda (reine Klassifikation — können kleine Modelle zuverlässig),
// 2. Antwort generieren (freier Text ohne JSON-Zwang — bessere Prosa, und die
//    Agenda ist da schon aktualisiert, sodass nichts erneut gefragt wird).
export async function interviewerReply(
  messages: InterviewMessage[],
  completedIds: string[],
  resumeContent: string | null,
  config: AIConfig
): Promise<{ reply: string; completed: string[] }> {
  const ai = getAIClient(config.provider || 'mistral', config.apiKey, config.baseUrl)
  const model = ai.chat(config.model || defaultModel(config.provider || 'mistral'))

  const history = messages
    .map((m) => `${m.role === 'assistant' ? 'INTERVIEWER' : 'KANDIDAT'}: ${m.content}`)
    .join('\n\n')

  const validIds = new Set(INTERVIEW_GUIDE.map((i) => i.id))

  // --- Schritt 1: offene Agenda-Punkte gegen den Verlauf prüfen ---
  const newlyCompleted = await classifyCompleted(history, completedIds, model)
  const allCompleted = [...new Set([...completedIds, ...newlyCompleted])]

  const agenda = INTERVIEW_GUIDE.map((item) => {
    const done = allCompleted.includes(item.id)
    return `${done ? '[x]' : '[ ]'} ${item.id} (${item.category}: ${item.topic})\n    Abhak-Kriterium: ${item.criteria}`
  }).join('\n')

  const remaining = INTERVIEW_GUIDE.filter((i) => !allCompleted.includes(i.id))

  // --- Schritt 2: Antwort mit aktualisierter Agenda generieren ---
  const prompt = `Du bist eine erfahrene, warme HR-Interviewerin und führst ein Interview als natürlichen, interaktiven Chat auf Deutsch. Es ist ein GESPRÄCH, kein Fragebogen: Du hörst zu, greifst Punkte auf, schweifst kurz mit, beantwortest Rückfragen — und führst die Unterhaltung dabei organisch durch deine Agenda.

DEINE AGENDA (abgehakt = [x], offen = [ ]) — Stand inklusive der letzten Antwort:
${agenda}

${resumeContent ? `LEBENSLAUF DES KANDIDATEN:\n${resumeContent.substring(0, 3000)}\n` : 'ES LIEGT KEIN LEBENSLAUF VOR — stelle Basisfragen zu Erfahrung und Skills etwas ausführlicher.\n'}
BISHERIGER VERLAUF:
${history || '(noch leer)'}

REGELN:
- Freie Gesprächsführung: Die Reihenfolge der offenen Punkte ist dir überlassen; schließe an, was der Kandidat gerade erzählt.
${resumeContent ? `- Nutze den Lebenslauf AKTIV: Sprich konkrete Stationen, Projekte oder Skills namentlich an ("In deinem Lebenslauf steht X — erzähl mir mehr dazu"), nutze sie als Aufhänger für STAR-Nachfragen, und achte darauf, dass die genannten Beispiele und Stärken zum Lebenslauf passen. Stelle keine Fragen, die der Lebenslauf schon beantwortet (z.B. "Wo hast du zuletzt gearbeitet?").
- Die Mini-Aufgabe muss zum Profil aus dem Lebenslauf passen (Technologien, Seniorität, Fachrichtung).
` : ''}- NIEMALS eine Frage wiederholen — auch nicht umformuliert. Abgehakte Punkte [x] sind erledigt: frage nicht mehr danach, auch nicht "zur Sicherheit". Prüfe vor jeder Frage den Verlauf: Wurde das schon gefragt oder beiläufig beantwortet? Dann greife einen neuen Aspekt auf oder gehe zum nächsten offenen Punkt über.
- Bei teilweise beantworteten Punkten: frage gezielt NUR den fehlenden Aspekt ("Und was war am Ende das Ergebnis?"), nicht das ganze Thema erneut.
- Bei oberflächlichen Antworten: freundlich nachfassen ("Was war genau DEIN Beitrag?", "Woran hat man das Ergebnis gemerkt?").
- Maximal 1–2 Fragen pro Nachricht. Würdige Antworten kurz und mit sichtbarem Bezug zum Gesagten (konkretes Detail aufgreifen) — aber variiere deine Formulierungen, keine wiederholten Lob- oder Übergangsfloskeln.
- Die Mini-Aufgabe (Praxisaufgabe) stellst du, wenn es passt — frühestens, wenn Stärken und Schwächen abgehakt sind. ${MINI_TASK_CATALOG}
- Duzen, lockerer aber professioneller Ton.
- Sind alle Punkte abgehakt, verabschiede dich mit einer kurzen, ehrlichen Zusammenfassung.

Offene Punkte: ${remaining.map((i) => i.id).join(', ') || 'keine — Interview abschließen'}.
Antworte NUR mit deiner nächsten Nachricht an den Kandidaten (Klartext, kein JSON, keine Meta-Kommentare).`

  const { text } = await generateText({
    model,
    messages: [{ role: 'user', content: prompt }],
  })

  return {
    reply: text?.trim() ? text.trim() : 'Kannst du das noch etwas genauer beschreiben?',
    completed: [...allCompleted].filter((id) => validIds.has(id) && !completedIds.includes(id)),
  }
}

// Reine Klassifikation: Welche offenen Agenda-Punkte sind über den Verlauf
// hinweg erfüllt? Bewusst getrennt von der Antwort-Generierung — kleine Modelle
// sind bei "eine Aufgabe, eine JSON-Liste" deutlich zuverlässiger als bei
// "schreibe Prosa UND tracke nebenbei State".
async function classifyCompleted(
  history: string,
  alreadyCompleted: string[],
  model: ReturnType<ReturnType<typeof getAIClient>['chat']>
): Promise<string[]> {
  const openItems = INTERVIEW_GUIDE.filter((i) => !alreadyCompleted.includes(i.id))
  if (openItems.length === 0) return []

  const checklist = openItems
    .map((item) => `- ${item.id} (${item.topic})\n  Erfüllt wenn: ${item.criteria}`)
    .join('\n')

  const prompt = `Du prüfst ein Interview-Transkript gegen eine Checkliste. Entscheide für jeden OFFENEN Punkt, ob er über den GESAMTEN Verlauf hinweg erfüllt ist — auch wenn die Antwort über mehrere Nachrichten verteilt kam oder beiläufig fiel.

OFFENE PUNKTE:
${checklist}

TRANSKRIPT:
${history}

Regeln:
- Hake NUR ab, wenn der Kandidat zum Thema des Punkts tatsächlich Inhalt geliefert hat. Ein Punkt, der im Transkript gar nicht vorkommt, ist niemals erfüllt.
- Substanziell beantwortet reicht — Perfektion ist nicht nötig. Verteilt über mehrere Nachrichten oder beiläufig gegeben zählt.
- Hake NICHT ab, wenn der Punkt nur angeschnitten, aber inhaltlich leer geblieben ist (z.B. Stärke genannt, aber ohne jegliches Beispiel).
- Die Mini-Aufgabe (mini-task) ist erst erfüllt, wenn eine Aufgabe gestellt UND beantwortet UND vom Interviewer kommentiert wurde.

Antworte AUSSCHLIESSLICH als JSON:
{ "completed": [{ "id": "punkt-id", "evidence": "wörtliches Zitat des KANDIDATEN aus dem Transkript, das den Punkt belegt" }] }
Nur IDs aus der Liste oben. "evidence" muss wörtlich aus dem Transkript stammen (kann gekürzt sein). Leere Liste, wenn keiner erfüllt ist.`

  try {
    const { text } = await generateText({
      model,
      messages: [{ role: 'user', content: prompt }],
    })
    const result = parseJsonFromText(text || '{}')
    const validIds = new Set(openItems.map((i) => i.id))
    const entries: unknown[] = Array.isArray(result.completed) ? result.completed : []

    // Evidenz-Check: Das Zitat muss (whitespace-normalisiert) im Transkript
    // vorkommen — halluzinierte Abhakungen werden so verworfen.
    const normalizedHistory = normalizeForMatch(history)
    return entries
      .filter((e: unknown): e is { id: string; evidence: string } =>
        typeof e === 'object' && e !== null &&
        typeof (e as { id?: unknown }).id === 'string' && validIds.has((e as { id: string }).id) &&
        typeof (e as { evidence?: unknown }).evidence === 'string' &&
        (e as { evidence: string }).evidence.trim().length >= 10
      )
      .filter((e: { id: string; evidence: string }) => normalizedHistory.includes(normalizeForMatch(e.evidence)))
      .map((e: { id: string; evidence: string }) => e.id)
  } catch (error) {
    console.error('Checklist classification error:', error)
    return []
  }
}

function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
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
