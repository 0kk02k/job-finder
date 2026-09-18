// Geführtes HR-Interview: Der strukturierte Leitfaden ist die Agenda im Hintergrund,
// die Konversation selbst ist ein freier, interaktiver Chat. Einzelne Leitfaden-Punkte
// werden abgehakt, sobald sie befriedigend beantwortet wurden (strukturierte Interviews
// haben laut Schmidt & Hunter 1998 deutlich höhere Validität als unstrukturierte —
// die Struktur steckt deshalb in der Checkliste, nicht im Gesprächsfluss).

import { getAIClient, scoringChat, defaultModel, parseJsonFromText, generateTextGuarded } from './ai'
// Evidenz-Zitate verifizieren — derselbe Beleg-Maßstab wie im Präferenz-Gespräch
import { filterVerifiedEvidence, renderPreferenceBlock } from './preference-profile'
import type { PreferenceProfile } from './preference-profile'
import { parseSkills } from './anecdotes'

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

// Exportiert für den Prompt-Vertragstest (tests/lib/interview.test.ts)
export const MINI_TASK_CATALOG = `Wenn du die Mini-Aufgabe stellst, wähle EINEN Aufgabentyp und baue die konkrete Aufgabe aus der Fachrichtung des Kandidaten (Lebenslauf) — die Arbeitsprobe muss klingen wie der Job, auf den sie vorbereitet:
- Fallvignette: eine knappe, typische Situation aus dem Fachgebiet — „X meldet sich mit Y. Was ist dein erster Schritt, und warum?"
- Priorisierung: 4-5 Fälle oder Aufgaben aus dem Fachgebiet, die unter knappen Ressourcen (Zeit, Personal, Budget) sortiert und begründet werden müssen
- Erkläraufgabe: ein Konzept aus dem Bereich, verständlich erklärt für jemanden ohne Fachhintergrund (Angehörige, Kunden, Verwaltung)
- Rollenspiel: ein typisches Gespräch der Rolle (Beratung, Beschwerde, Übergabe) — du spielst die Gegenseite, in 3-4 Nachrichten
- Dokumentationsaufgabe: ein Ergebnis der Rolle strukturiert festhalten (Bericht, Übergabeprotokoll, Anleitung)
Technische Arbeitsproben (Code-Review, Ticket-Priorisierung) sind NUR passend, wenn der Lebenslauf technisch ist — für alle anderen Fachrichtungen gehören sie nicht in die enge Wahl. Bewerte die Antwort nach Korrektheit, Begründungsqualität und Vollständigkeit und gib kurzes, ehrliches Feedback.`

interface AIConfig {
  provider?: string
  model?: string
  apiKey?: string
  baseUrl?: string
}

// ---------------------------------------------------------------------------
// Gesprächskontext: Präferenz-Profil + Anekdoten (Zwei-Phasen-Flow)
// ---------------------------------------------------------------------------

// Anekdote in der Form, in der sie ins Gespräch darf — die Prisma-Zeile
// trägt skills als JSON-String, der Prompt braucht sie als Liste.
export interface AnecdoteRef {
  id: string
  title: string
  situation: string
  action: string
  result: string
  skills: string[]
}

export interface InterviewContext {
  preferenceProfile?: PreferenceProfile | null
  anecdotes?: AnecdoteRef[]
}

export interface InterviewerOptions {
  context?: InterviewContext
  // Epoch-ms-Gesamtfrist der Route — kappt jeden Guard-Versuch am Restbudget.
  deadline?: number
}

// Prisma-Zeile → Prompt-Referenz (skills-JSON wird geparst, Müll wird zu []).
export function anecdoteFromRow(row: {
  id: string
  title: string
  situation: string
  action: string
  result: string
  skills: string
}): AnecdoteRef {
  return {
    id: row.id,
    title: row.title,
    situation: row.situation,
    action: row.action,
    result: row.result,
    skills: parseSkills(row.skills),
  }
}

// Dedupe gegen das Präferenz-Gespräch: Diese Agenda-Punkte gelten als geklärt,
// sobald das Profil sie inhaltlich abdeckt — sie werden als abgehakt
// vorgemerkt und die Interviewerin bekommt sie nicht mehr als offen gezeigt.
const PROFILE_COVERAGE: Record<string, (p: PreferenceProfile) => boolean> = {
  // Wechselmotivation ≈ Entwicklungswunsch plus das, was Freude macht
  'motivation-change': (p) => p.growth.trim().length > 0 || p.enjoys.trim().length > 0,
  // Ziele der nächsten Rolle ≈ gewichtete Kriterien (Umfeld, Aufgaben, Gehalt …)
  'goals-next-role': (p) => p.criteria.length >= 2,
}

// Anekdoten sind STAR-Rohmaterial: Jede steht für eine Stärke mit Beispiel,
// Konflikt- und Druck-Geschichten decken die Verhaltensfragen mit ab.
const ANECDOTE_CONFLICT_PATTERN = /konflikt|streit|widerstand|schwierig|vermittel|eskalat/i
const ANECDOTE_PRESSURE_PATTERN = /druck|deadline|termin|zeitdruck|prioris|knapp|ressourcen/i

function anecdoteSignals(a: AnecdoteRef): string {
  return `${a.title} ${a.skills.join(' ')}`
}

export function agendaItemsCoveredByProfile(
  profile: PreferenceProfile | null | undefined
): string[] {
  if (!profile) return []
  return INTERVIEW_GUIDE.filter((item) => PROFILE_COVERAGE[item.id]?.(profile) ?? false).map(
    (i) => i.id
  )
}

export function agendaItemsCoveredByAnecdotes(
  anecdotes: AnecdoteRef[] | null | undefined
): string[] {
  if (!anecdotes || anecdotes.length === 0) return []
  const covered = new Set<string>()
  if (anecdotes.length >= 1) covered.add('strength-1')
  if (anecdotes.length >= 2) covered.add('strength-2')
  const signals = anecdotes.map(anecdoteSignals)
  if (signals.some((t) => ANECDOTE_CONFLICT_PATTERN.test(t))) covered.add('teamwork-conflict')
  if (signals.some((t) => ANECDOTE_PRESSURE_PATTERN.test(t))) covered.add('pressure-priorities')
  return INTERVIEW_GUIDE.filter((i) => covered.has(i.id)).map((i) => i.id)
}

// Alle Agenda-Punkte, die ohne ein einziges Interview-Wort als geklärt gelten
// können — die Route trägt sie als abgehakt ein (Session-Start und Fortsetzen).
export function coveredAgendaIds(
  profile: PreferenceProfile | null | undefined,
  anecdotes: AnecdoteRef[] | null | undefined
): string[] {
  return [
    ...new Set([
      ...agendaItemsCoveredByProfile(profile),
      ...agendaItemsCoveredByAnecdotes(anecdotes),
    ]),
  ]
}

// Kontextblock fürs System-Prompt: Was das Präferenz-Gespräch schon geklärt
// und was der Nutzer an Anekdoten hinterlegt hat. Ohne beides bleibt der
// Prompt byte-identisch zur Zeit vor dem Zwei-Phasen-Flow.
export function buildInterviewContextBlock(context: InterviewContext): string {
  const blocks: string[] = []
  const profile = context.preferenceProfile
  if (profile) {
    blocks.push(
      `BEREITS GEKLÄRT — PRÄFERENZEN DES KANDIDATEN (aus einem eigenen Gespräch, vom Kandidaten bestätigt):\n` +
        `${renderPreferenceBlock(profile)}\n` +
        `Diese Themen sind abgehakt: Frage sie NICHT erneut — höchstens, wenn der Kandidat sie selbst aufbringt, darfst du vertiefen.`
    )
  }
  const anecdotes = context.anecdotes ?? []
  if (anecdotes.length > 0) {
    blocks.push(
      `WAHRE ANEKDOTEN DES KANDIDATEN (von ihm gepflegt — STAR-Rohmaterial):\n` +
        anecdotes
          .map(
            (a, i) =>
              `${i + 1}. „${a.title}“ — Situation: ${a.situation} Aufgabe/Handlung: ${a.action} Ergebnis: ${a.result} (Qualitäten: ${a.skills.join(', ') || '—'})`
          )
          .join('\n') +
        `\nNutze sie aktiv: Greife sie als Aufhänger auf („Du hast mal erzählt, dass … — erzähl mir daraus mehr"), statt STAR-Beispiele bei Null zu erfragen.`
    )
  }
  return blocks.join('\n\n')
}

// Beleg-Material für die Auswertung: Die Akte darf Stärken-Belege (starExample)
// aus den Anekdoten nehmen, wenn das Gespräch ein Thema als bereits geklärt
// übersprungen hat. Ansonsten bleibt es beim Transkript-Beleg.
export function buildInsightsAnecdoteBlock(
  anecdotes: AnecdoteRef[] | null | undefined
): string {
  if (!anecdotes || anecdotes.length === 0) return ''
  return (
    `VORHANDENE ANEKDOTEN DES KANDIDATEN (wahr, vom Kandidaten gepflegt — Beleg-Material):\n` +
    anecdotes
      .map(
        (a, i) =>
          `${i + 1}. „${a.title}“ — Situation: ${a.situation} Aufgabe/Handlung: ${a.action} Ergebnis: ${a.result}`
      )
      .join('\n') +
    `\nWurde ein Thema im Transkript nicht besprochen, weil es bereits geklärt war, darfst du Belege (z. B. starExample bei Stärken) aus diesen Anekdoten nehmen — sonst gilt: nur Transkript-Belege, nichts erfinden.`
  )
}

// Nächster Interviewer-Zug im freien Gespräch. Läuft in zwei getrennten KI-Calls:
// 1. Abhaken der Agenda (reine Klassifikation — können kleine Modelle zuverlässig),
// 2. Antwort generieren (freier Text ohne JSON-Zwang — bessere Prosa, und die
//    Agenda ist da schon aktualisiert, sodass nichts erneut gefragt wird).
export async function interviewerReply(
  messages: InterviewMessage[],
  completedIds: string[],
  resumeContent: string | null,
  config: AIConfig,
  options: InterviewerOptions = {}
): Promise<{ reply: string; completed: string[] }> {
  // Schnelles Scoring-Modell statt Kimi-K3: K3 denkt auf offenen Gesprächs-
  // Prompts minutenlang (im Präferenz-Gespräch hat das den Runtime-Timeout
  // ausgelöst) — Klassifikation und kurze Prosa-Antwort sind kleine Aufgaben.
  const model = scoringChat(config.provider || 'nebius', config.apiKey, config.baseUrl, config.model)
  const deadline = options.deadline

  const history = messages
    .map((m) => `${m.role === 'assistant' ? 'INTERVIEWER' : 'KANDIDAT'}: ${m.content}`)
    .join('\n\n')

  const validIds = new Set(INTERVIEW_GUIDE.map((i) => i.id))

  // --- Schritt 1: offene Agenda-Punkte gegen den Verlauf prüfen ---
  const newlyCompleted = await classifyCompleted(history, completedIds, model, deadline)
  const allCompleted = [...new Set([...completedIds, ...newlyCompleted])]

  const agenda = INTERVIEW_GUIDE.map((item) => {
    const done = allCompleted.includes(item.id)
    return `${done ? '[x]' : '[ ]'} ${item.id} (${item.category}: ${item.topic})\n    Abhak-Kriterium: ${item.criteria}`
  }).join('\n')

  const remaining = INTERVIEW_GUIDE.filter((i) => !allCompleted.includes(i.id))

  const contextBlock = buildInterviewContextBlock(options.context ?? {})

  // --- Schritt 2: Antwort mit aktualisierter Agenda generieren ---
  const prompt = `Du bist eine erfahrene, warme HR-Interviewerin und führst ein Interview als natürlichen, interaktiven Chat auf Deutsch. Es ist ein GESPRÄCH, kein Fragebogen: Du hörst zu, greifst Punkte auf, schweifst kurz mit, beantwortest Rückfragen — und führst die Unterhaltung dabei organisch durch deine Agenda.

DEINE AGENDA (abgehakt = [x], offen = [ ]) — Stand inklusive der letzten Antwort:
${agenda}

${resumeContent ? `LEBENSLAUF DES KANDIDATEN:\n${resumeContent.substring(0, 3000)}\n` : 'ES LIEGT KEIN LEBENSLAUF VOR — stelle Basisfragen zu Erfahrung und Skills etwas ausführlicher.\n'}${contextBlock ? `${contextBlock}\n\n` : ''}BISHERIGER VERLAUF:
${history || '(noch leer)'}

REGELN:
- Freie Gesprächsführung: Die Reihenfolge der offenen Punkte ist dir überlassen; schließe an, was der Kandidat gerade erzählt.
${resumeContent ? `- Nutze den Lebenslauf AKTIV: Sprich konkrete Stationen, Projekte oder Skills namentlich an ("In deinem Lebenslauf steht X — erzähl mir mehr dazu"), nutze sie als Aufhänger für STAR-Nachfragen, und achte darauf, dass die genannten Beispiele und Stärken zum Lebenslauf passen. Stelle keine Fragen, die der Lebenslauf schon beantwortet (z.B. "Wo hast du zuletzt gearbeitet?").
- Die Mini-Aufgabe muss zum Profil aus dem Lebenslauf passen (Technologien, Seniorität, Fachrichtung).
` : ''}${contextBlock ? `- BEREITS GEKLÄRTE Themen (siehe Kontext oben) werden nicht erneut abgefragt — höchstens vertieft, wenn der Kandidat sie selbst aufbringt.
` : ''}- NIEMALS eine Frage wiederholen — auch nicht umformuliert. Abgehakte Punkte [x] sind erledigt: frage nicht mehr danach, auch nicht "zur Sicherheit". Prüfe vor jeder Frage den Verlauf: Wurde das schon gefragt oder beiläufig beantwortet? Dann greife einen neuen Aspekt auf oder gehe zum nächsten offenen Punkt über.
- Bei teilweise beantworteten Punkten: frage gezielt NUR den fehlenden Aspekt ("Und was war am Ende das Ergebnis?"), nicht das ganze Thema erneut.
- Bei oberflächlichen Antworten: freundlich nachfassen ("Was war genau DEIN Beitrag?", "Woran hat man das Ergebnis gemerkt?").
- Maximal 1–2 Fragen pro Nachricht. Würdige Antworten kurz und mit sichtbarem Bezug zum Gesagten (konkretes Detail aufgreifen) — aber variiere deine Formulierungen, keine wiederholten Lob- oder Übergangsfloskeln.
- Die Mini-Aufgabe (Praxisaufgabe) stellst du, wenn es passt — frühestens, wenn Stärken und Schwächen abgehakt sind. ${MINI_TASK_CATALOG}
- Duzen, lockerer aber professioneller Ton.
- Sind alle Punkte abgehakt, verabschiede dich mit einer kurzen, ehrlichen Zusammenfassung.

Offene Punkte: ${remaining.map((i) => i.id).join(', ') || 'keine — Interview abschließen'}.
Antworte NUR mit deiner nächsten Nachricht an den Kandidaten (Klartext, kein JSON, keine Meta-Kommentare).`

  // Guard: Der Turn hat zwei KI-Calls — ein hängender Call darf den Request
  // nicht bis zum Runtime-Kill aufhalten (in Produktion beobachtet). 60s je
  // Versuch, 1 Retry, Gesamtfrist der Route deckelt das Restbudget.
  const { text } = await generateTextGuarded(
    {
      model,
      messages: [{ role: 'user', content: prompt }],
    },
    60_000,
    1,
    deadline
  )

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
  model: ReturnType<ReturnType<typeof getAIClient>['chat']>,
  deadline?: number
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
    // Guard: Ein hängender Klassifikator-Call darf den Turn nicht aufhalten —
    // fällt er aus, bleibt die Agenda einfach unverändert ([], siehe catch).
    const { text } = await generateTextGuarded(
      {
        model,
        messages: [{ role: 'user', content: prompt }],
      },
      60_000,
      1,
      deadline
    )
    const result = parseJsonFromText(text || '{}')

    // Derselbe Beleg-Maßstab wie im Präferenz-Gespräch (filterVerifiedEvidence):
    // wörtlich ODER als Paraphrase im Transkript belegt — halluzinierte
    // Abhakungen fallen weg. Der frühere strikte Substring-Filter hier hat
    // echte Abhakungen sterben lassen; mit dem expliziten finish:true-Vertrag
    // der Route ist er nicht mehr nötig — stecken gebliebene Agenden werden
    // vom Nutzer beendet statt vom Modell geraten.
    return filterVerifiedEvidence(
      result.completed,
      openItems.map((i) => i.id),
      history
    )
  } catch (error) {
    console.error('Checklist classification error:', error)
    return []
  }
}

// Abschluss: strukturierte Insights aus dem kompletten Transkript erzeugen.
// Anekdoten sind Beleg-Material für Punkte, die das Gespräch als bereits
// geklärt übersprungen hat (Zwei-Phasen-Flow) — der Report bekommt seine
// Stärken-Belege so auch ohne erneutes Nachfragen.
export async function generateInsights(
  messages: InterviewMessage[],
  config: AIConfig,
  options: { anecdotes?: AnecdoteRef[]; deadline?: number } = {}
): Promise<InterviewInsights | null> {
  const ai = getAIClient(config.provider || 'nebius', config.apiKey, config.baseUrl)

  const transcript = messages
    .map((m) => `${m.role === 'assistant' ? 'INTERVIEWER' : 'KANDIDAT'}: ${m.content}`)
    .join('\n\n')

  const anecdoteBlock = buildInsightsAnecdoteBlock(options.anecdotes)

  const prompt = `Du bist HR-Analystin. Werte dieses Interview-Transkript aus und erstelle eine strukturierte Kandidaten-Akte auf Deutsch.

TRANSKRIPT:
${transcript}
${anecdoteBlock ? `\n${anecdoteBlock}\n` : ''}
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
    // Insights bleiben auf dem Standard-Modell: echte Analyse-Arbeit (STAR-
    // Bewertung, Mini-Task), nur einmal pro Interview — bei Fehlschlag bleibt
    // die Akte ehrlich leer (null), die Route läuft weiter. Das Modell denkt
    // mit, deshalb die längere Frist; die Gesamtfrist der Route deckelt das
    // Restbudget, damit ein spät startender Call die Session nicht killt.
    const { text } = await generateTextGuarded(
      {
        model: ai.chat(config.model || defaultModel(config.provider || 'nebius')),
        messages: [{ role: 'user', content: prompt }],
      },
      120_000,
      1,
      options.deadline
    )
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
