// Präferenz-Gespräch: Der guided Chat erfasst, was der Nutzer an Arbeit wirklich
// will — Freude, Gewichtung, No-Gos, Entwicklung — und verdichtet ihn zu einem
// strukturierten Profil, das Scoring und Suche personalisiert. Bewusst parallel
// zu lib/interview.ts (nicht auf eine gemeinsame Basis refactored): Die zwei
// Gespräche unterscheiden inhaltlich (STAR-Arbeitsprobe vs. Kriterien-
// gewichtung), eine geteilte Abstraktion würde zwei sich entwickelnde Prompts
// koppeln. Der reine Kern (Guide, Sanitizing, Rendering) lebt import-frei in
// lib/preference-profile.ts — diese Datei hält nur die KI-Calls.

import { getAIClient, scoringChat, parseJsonFromText, generateTextGuarded } from './ai'
import {
  filterVerifiedEvidence,
  PREFERENCE_GUIDE,
  sanitizePreferenceProfile,
} from './preference-profile'
import type { PreferenceProfile } from './preference-profile'
import type { GuideItem, InterviewMessage } from './interview'

// Re-Export: bestehende Importeure (Route, Tests) finden den ganzen Umfang
// hier; Client-Komponenten importieren direkt aus ./preference-profile.
export {
  PREFERENCE_GUIDE,
  PREFERENCE_OPENING_MESSAGE,
  condensePreferenceProfile,
  filterVerifiedEvidence,
  parseStoredProfile,
  renderPreferenceBlock,
  sanitizePreferenceProfile,
  normalizeForMatch,
} from './preference-profile'
export type { PreferenceCriteria, PreferenceProfile } from './preference-profile'
export type { GuideItem, InterviewMessage }

interface AIConfig {
  provider?: string
  model?: string
  apiKey?: string
  baseUrl?: string
}

// Nächster Berater-Zug im Präferenz-Gespräch. Call 1: offene Agenda gegen den
// Verlauf abhaken (reine Klassifikation), Call 2: Antwort mit aktualisierter
// Agenda generieren — nichts wird doppelt gefragt.
export async function preferenceInterviewerReply(
  messages: InterviewMessage[],
  completedIds: string[],
  resumeContent: string | null,
  config: AIConfig
): Promise<{ reply: string; completed: string[] }> {
  // Bewusst das schnelle Scoring-Modell, NICHT Kimi-K3: K3 denkt auf offenen
  // Gesprächs-Prompts minutenlang — in Production ist der Turn deshalb nach
  // 300s vom Runtime-Timeout gekillt worden („Die Beraterin schreibt …" ohne
  // Ende). Klassifikation und kurze Prosa-Antwort sind kleine Aufgaben —
  // scoringChat liefert das Modell ohne Denkpause (dieselbe Erfahrung wie
  // beim Scoring).
  const model = scoringChat(config.provider || 'nebius', config.apiKey, config.baseUrl, config.model)

  const history = messages
    .map((m) => `${m.role === 'assistant' ? 'BERATERIN' : 'NUTZER'}: ${m.content}`)
    .join('\n\n')

  const validIds = PREFERENCE_GUIDE.map((i) => i.id)

  // --- Schritt 1: offene Themen gegen den Verlauf prüfen ---
  const newlyCompleted = await classifyPreferenceCompleted(history, completedIds, model)
  const allCompleted = [...new Set([...completedIds, ...newlyCompleted])]

  const agenda = PREFERENCE_GUIDE.map((item) => {
    const done = allCompleted.includes(item.id)
    return `${done ? '[x]' : '[ ]'} ${item.id} (${item.category}: ${item.topic})\n    Abhak-Kriterium: ${item.criteria}`
  }).join('\n')

  const remaining = PREFERENCE_GUIDE.filter((i) => !allCompleted.includes(i.id))

  // --- Schritt 2: Antwort mit aktualisierter Agenda generieren ---
  const prompt = `Du bist eine aufmerksame Karriereberaterin und führst ein kurzes, warmes Präferenz-Gespräch als natürlichen Chat auf Deutsch. Ziel: Du erfasst, was der Nutzer an Arbeit wirklich Freude macht, wie er Kriterien gewichtet, was er vermeiden will und wohin er sich entwickeln möchte — am Ende entsteht daraus ein Präferenzen-Profil, das die Job-Bewertung dieser App personalisiert.

DEINE AGENDA (abgehakt = [x], offen = [ ]) — Stand inklusive der letzten Antwort:
${agenda}

${resumeContent ? `LEBENSLAUF DES NUTZERS:\n${resumeContent.substring(0, 3000)}\n` : ''}
BISHERIGER VERLAUF:
${history || '(noch leer)'}

REGELN:
- Freie Gesprächsführung: Die Reihenfolge der offenen Themen ist dir überlassen; schließe an, was der Nutzer gerade erzählt.
${resumeContent ? `- Nutze den Lebenslauf AKTIV als Aufhänger („In deinem Lebenslauf steht X — was davon machst du am liebsten?“). Stelle keine Fragen, die der Lebenslauf schon beantwortet.\n` : ''}- Beim Gewichtungsthema (weights) verlange explizit eine Rangordnung: „Was wiegt schwerer?“ — drei bis fünf Kriterien, geordnet, nicht nur aufgezählt.
- NIEMALS eine Frage wiederholen — auch nicht umformuliert. Abgehakte Themen [x] sind erledigt: frage nicht mehr danach, auch nicht „zur Sicherheit“.
- Maximal 1–2 Fragen pro Nachricht. Würdige Antworten kurz mit sichtbarem Bezug zum Gesagten — variiere deine Formulierungen, keine wiederholten Lob-Floskeln.
- Duzen, lockerer aber professioneller Ton.
- Sind alle Themen abgehakt, verabschiede dich kurz und sage, dass du jetzt das Präferenzen-Profil erstellst.

Offene Themen: ${remaining.map((i) => i.id).join(', ') || 'keine — Gespräch abschließen'}.
Antworte NUR mit deiner nächsten Nachricht an den Nutzer (Klartext, kein JSON, keine Meta-Kommentare).`

  const { text } = await generateTextGuarded({
    model,
    messages: [{ role: 'user', content: prompt }],
  })

  return {
    reply: text?.trim() ? text.trim() : 'Kannst du das noch etwas genauer beschreiben?',
    completed: [...allCompleted].filter((id) => validIds.includes(id) && !completedIds.includes(id)),
  }
}

// Reine Klassifikation: Welche offenen Themen sind über den Verlauf hinweg
// erfüllt? Getrennt von der Antwort-Generierung — kleine Modelle sind bei
// „eine Aufgabe, eine JSON-Liste“ deutlich zuverlässiger.
async function classifyPreferenceCompleted(
  history: string,
  alreadyCompleted: string[],
  model: ReturnType<ReturnType<typeof getAIClient>['chat']>
): Promise<string[]> {
  const openItems = PREFERENCE_GUIDE.filter((i) => !alreadyCompleted.includes(i.id))
  if (openItems.length === 0) return []

  const checklist = openItems
    .map((item) => `- ${item.id} (${item.topic})\n  Erfüllt wenn: ${item.criteria}`)
    .join('\n')

  const prompt = `Du prüfst ein Gesprächs-Transkript gegen eine Checkliste. Entscheide für jedes OFFENE Thema, ob es über den GESAMTEN Verlauf hinweg erfüllt ist — auch wenn die Antwort über mehrere Nachrichten verteilt kam oder beiläufig fiel.

OFFENE THEMEN:
${checklist}

TRANSKRIPT:
${history}

Regeln:
- Hake NUR ab, wenn der Nutzer zum Thema des Punkts tatsächlich Inhalt geliefert hat. Ein Thema, das im Transkript gar nicht vorkommt, ist niemals erfüllt.
- Substanziell beantwortet reicht — Perfektion ist nicht nötig.
- weights ist erst erfüllt, wenn eine Rangordnung erkennbar ist (was wiegt schwerer) — eine bloße Aufzählung ohne Ordnung reicht nicht.
- avoid ist auch erfüllt, wenn der Nutzer ausdrücklich sagt, dass er nichts ausdrücklich ausschließen will.

Antworte AUSSCHLIESSLICH als JSON:
{ "completed": [{ "id": "thema-id", "evidence": "wörtliches Zitat des NUTZERS aus dem Transkript, das das Thema belegt" }] }
Nur IDs aus der Liste oben. "evidence" muss wörtlich aus dem Transkript stammen (kann gekürzt sein). Leere Liste, wenn keins erfüllt ist.`

  try {
    const { text } = await generateTextGuarded({
      model,
      messages: [{ role: 'user', content: prompt }],
    })
    const result = parseJsonFromText(text || '{}')
    return filterVerifiedEvidence(
      result.completed,
      openItems.map((i) => i.id),
      history
    )
  } catch (error) {
    console.error('Präferenz-Checkliste Klassifikationsfehler:', error)
    return []
  }
}

// Abschluss: das strukturierte Profil aus dem kompletten Transkript erzeugen.
// null heißt ehrlich: kein Profil — nie ein erfundenes.
export async function synthesizePreferenceProfile(
  messages: InterviewMessage[],
  config: AIConfig
): Promise<PreferenceProfile | null> {
  const transcript = messages
    .map((m) => `${m.role === 'assistant' ? 'BERATERIN' : 'NUTZER'}: ${m.content}`)
    .join('\n\n')

  const prompt = `Du erstellst aus diesem Präferenz-Gespräch ein strukturiertes Profil des Nutzers auf Deutsch. Es wird später in die Job-Bewertung einfließen — präzise Belege sind wichtiger als Vollständigkeit.

TRANSKRIPT:
${transcript}

Gib zurück als JSON:
{
  "enjoys": "Woran der Nutzer Freude hat, 1-2 Sätze, nah an seinen Worten",
  "criteria": [
    { "topic": "Kriterium, kurz (z. B. Tech-Stack, Remote, Team, Gehalt, Sicherheit, Wachstum, Sinn)",
      "weight": "hoch" | "mittel" | "niedrig",
      "note": "Beleg, kurz, im Wortlaut des Nutzers" }
  ],
  "avoids": ["No-Go, kurz, im Wortlaut des Nutzers"],
  "growth": "Entwicklungswunsch, 1-2 Sätze",
  "summary": "Gesamtprofil in 1-2 Sätzen",
  "keywords": ["3-8 kurze suchrelevante Begriffe: Rollen und Schwerpunkte"]
}

Regeln:
- Nur im Transkript belegte Aussagen — nichts erfinden, keine Standard-Wünsche einsetzen.
- Gewichte nur aus klar geäußerter Wichtigkeit: eindeutig wichtig → "hoch", abgewertet → "niedrig", alles Unklare → "mittel".
- Kriterien ordnen sich nach der vom Nutzer geäußerten Rangordnung.
- Kein Thema wurde angesprochen → Feld leer lassen ("enjoys": "", "criteria": [], "avoids": [], "growth": "").

Gib AUSSCHLIESSLICH das JSON aus — kein Vorwort, keine Anmerkungen.`

  try {
    // Auch die Synthese auf dem schnellen Modell: Sie extrahiert nur belegte
    // Nutzer-Aussagen in ein JSON-Schema (keine Kreation) — und sie läuft im
    // selben Request wie der letzte Chat-Turn, der sich sonst denselben
    // K3-Denk-Marathon mit dem Prosa-Zug teilt.
    const { text } = await generateTextGuarded({
      model: scoringChat(config.provider || 'nebius', config.apiKey, config.baseUrl, config.model),
      messages: [{ role: 'user', content: prompt }],
    })
    return sanitizePreferenceProfile(parseJsonFromText(text || '{}'))
  } catch (error) {
    console.error('Präferenz-Profil Synthesefehler:', error)
    return null
  }
}
