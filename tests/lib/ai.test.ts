// Das Anschreiben soll klingen wie die Anzeige, auf die es sich bewirbt:
// Register (Du/Sie), Wortschatz und Tonalität aus der Stellenanzeige.
// Getestet wird der Prompt-Vertrag — die KI selbst ist außen vor (lokal kein Key).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { attemptTimeoutMs, buildCoverLetterPrompt, buildScorePrompt, buildSearchQueryPrompt, buildSemanticRankingPrompt, buildTranslateResumePrompt, defaultModel, noThinkingFetch, scoringModel } from '../../lib/ai'
import type { PreferenceProfile } from '../../lib/preferences'

const PROFILE: PreferenceProfile = {
  version: 1,
  enjoys: 'Architektur-Entscheidungen',
  criteria: [
    { topic: 'Tech-Stack', weight: 'hoch', note: 'moderner JS-Stack' },
    { topic: 'Remote', weight: 'mittel', note: '' },
  ],
  avoids: ['Bereitschaftsdienst'],
  growth: 'Mehr Backend',
  summary: 'Frontend mit Backend-Ambitionen',
  keywords: ['React'],
}

const AD_DU_FORM = 'Dein Profil: Du liebst Kaffee und bringst Deine Ideen ein. Wir bieten dir ein starkes Team.'

test('prompt instructs the AI to mirror the ad’s Du/Sie register', () => {
  const prompt = buildCoverLetterPrompt('LEBENSLAUF', AD_DU_FORM, 'Firma', 'Barista')
  assert.match(prompt, /Du-\/Sie-Form|Ansprache\s+der\s+Anzeige/)
})

test('prompt instructs the AI to adopt vocabulary and tone from the ad', () => {
  const prompt = buildCoverLetterPrompt('LEBENSLAUF', AD_DU_FORM, 'Firma', 'Barista')
  assert.match(prompt, /Wortschatz|Begrifflichkeit|Formulierungen/)
  assert.match(prompt, /Tonalität|Sprachstil|Schreibstil/)
})

test('prompt carries resume, ad, company and title', () => {
  const prompt = buildCoverLetterPrompt('LEBENSLAUF', AD_DU_FORM, 'Rösterei Nord', 'Barista')
  assert.match(prompt, /LEBENSLAUF/)
  assert.match(prompt, /Rösterei Nord/)
  assert.match(prompt, /Barista/)
  assert.match(prompt, /Kaffee/)
})

test('English ad mandates an English letter — no hardcoded German', () => {
  const prompt = buildCoverLetterPrompt('LEBENSLAUF', 'We are looking for a backend engineer...', 'Firma', 'Engineer', 'en')
  assert.match(prompt, /[Ee]nglisch|[Ee]nglish/)
  assert.ok(!prompt.includes('auf Deutsch'), 'Deutsch darf bei englischer Anzeige nicht angeordnet sein')
  assert.match(prompt, /Tonalität|[Tt]one|[Ss]chreibstil/)
})

test('German ad keeps the German letter rules', () => {
  const prompt = buildCoverLetterPrompt('LEBENSLAUF', AD_DU_FORM, 'Firma', 'Barista', 'de')
  assert.match(prompt, /Deutsch/)
  assert.match(prompt, /Du-Form/)
})

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

test('score prompt puts the resume before the job description — cacheable prefix', () => {
  const prompt = buildScorePrompt('JOB-BESCHREIBUNG', 'LEBENSLAUF-TEXT', null)
  assert.match(prompt, /LEBENSLAUF-TEXT/)
  assert.match(prompt, /JOB-BESCHREIBUNG/)
  assert.ok(
    prompt.indexOf('LEBENSLAUF-TEXT') < prompt.indexOf('JOB-BESCHREIBUNG'),
    'Der Lebenslauf muss VOR der Anzeige stehen — er ist der identische Teil jedes Aufrufs und damit der Cache-Präfix'
  )
})

test('score prompt carries the salary wish only when set', () => {
  const withSalary = buildScorePrompt('JOB', 'LEBENSLAUF', 45000)
  const withoutSalary = buildScorePrompt('JOB', 'LEBENSLAUF', null)
  assert.match(withSalary, /45 ?000/)
  assert.ok(!withoutSalary.includes('Gehaltsvorstellung'))
})

test('score prompt demands the JSON verdict shape and the 1-10 scale', () => {
  const prompt = buildScorePrompt('JOB', 'LEBENSLAUF', null)
  assert.match(prompt, /JSON/)
  assert.match(prompt, /1-10/)
  assert.match(prompt, /"score"/)
  assert.match(prompt, /"reason"/)
})

test('scoringModel sends Nebius scoring to Kimi K2.6 — the user model is deliberately ignored', () => {
  assert.equal(scoringModel('nebius', 'moonshotai/Kimi-K3'), 'moonshotai/Kimi-K2.6')
  assert.equal(scoringModel('nebius', undefined), 'moonshotai/Kimi-K2.6')
})

test('noThinkingFetch injects chat_template_kwargs into JSON POST bodies', async () => {
  let seenBody: unknown = null
  const wrapped = noThinkingFetch(async (_input, init) => {
    seenBody = JSON.parse(init?.body as string)
    return new Response('{}')
  })
  await wrapped('https://example.com/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({ model: 'moonshotai/Kimi-K2.6', messages: [] }),
  })
  assert.deepEqual((seenBody as { chat_template_kwargs?: unknown }).chat_template_kwargs, { thinking: false })
  assert.equal((seenBody as { model?: string }).model, 'moonshotai/Kimi-K2.6', 'der Rest des Bodys bleibt unangetastet')
})

test('noThinkingFetch passes non-JSON requests through untouched', async () => {
  let seenBody: unknown = null
  const wrapped = noThinkingFetch(async (_input, init) => {
    seenBody = init?.body
    return new Response('{}')
  })
  await wrapped('https://example.com/v1/models', { method: 'GET' })
  assert.equal(seenBody, undefined)
})

test('scoringModel leaves other providers with their own model choice', () => {
  assert.equal(scoringModel('gemini', undefined), defaultModel('gemini'))
  assert.equal(scoringModel('openai', 'gpt-x'), 'gpt-x')
})

test('semantic ranking prompt carries deep descriptions — 800 chars, not 200', () => {
  const deep = 'A'.repeat(700) + 'BESONDERES-MERKMAL' + 'C'.repeat(200)
  const prompt = buildSemanticRankingPrompt('LEBENSLAUF', 'QUERY', [
    { title: 'T', company: 'F', location: 'L', description: deep, url: 'u', platform: 'p', relevanceScore: 0, matchReason: '', transferableSkills: [] },
  ])
  assert.match(prompt, /BESONDERES-MERKMAL/, 'Zeichen jenseits von 200 müssen im Prompt stehen — Fähigkeiten stehen oft tief in der Anzeige')
  assert.match(prompt, /LEBENSLAUF/)
  assert.match(prompt, /QUERY/)
  assert.match(prompt, /0\.6/)
})

test('semantic ranking prompt orders a compact answer — the answer time decides', () => {
  const prompt = buildSemanticRankingPrompt('LEBENSLAUF', 'QUERY', [
    { title: 'T', company: 'F', location: 'L', description: 'D', url: 'u', platform: 'p', relevanceScore: 0, matchReason: '', transferableSkills: [] },
  ])
  assert.match(prompt, /max\. 1 Satz/, 'Reasons in Romanlänge waren der 30s-Timeout beider Ranking-Chunks')
  assert.match(prompt, /max\. 3 Skills/)
})

// Guard gegen Gesamtfrist: ein Call, der kurz vor Fristablauf startet, darf die
// Frist nicht um seine volle Guard-Zeit überstehen — sonst kehrt die Scoring-
// Welle nie rechtzeitig zurück und der Lauf stirbt am 60s-Kill.
test('attemptTimeoutMs keeps the guard timeout when no deadline is set', () => {
  assert.equal(attemptTimeoutMs(25_000), 25_000)
})

test('attemptTimeoutMs keeps the guard timeout while the deadline is far away', () => {
  assert.equal(attemptTimeoutMs(25_000, 100_000, 1_000), 25_000)
})

test('attemptTimeoutMs clamps to the remaining budget near the deadline', () => {
  assert.equal(attemptTimeoutMs(25_000, 50_000, 45_000), 5_000)
})

test('attemptTimeoutMs reports a spent budget as null — no doomed call gets started', () => {
  assert.equal(attemptTimeoutMs(25_000, 50_000, 50_000), null)
  assert.equal(attemptTimeoutMs(25_000, 50_000, 60_000), null)
})

test('resume translation prompt forbids inventing facts and keeps structure', () => {
  const prompt = buildTranslateResumePrompt('Berufserfahrung\n- 3 Jahre Erfahrung', 'en')
  assert.match(prompt, /[Ee]nglisch|[Ee]nglish/)
  assert.match(prompt, /3 Jahre Erfahrung/)
  assert.match(prompt, /erfinde|keine neuen|do not invent|no new|unverändert|unchanged|exakt|exactly/i)
})

test('score prompt is byte-identical without preferences — the cache prefix survives', () => {
  assert.equal(buildScorePrompt('JOB', 'LEBENSLAUF', null), buildScorePrompt('JOB', 'LEBENSLAUF', null, null))
})

test('score prompt embeds preferences after the resume, before rules and job — still cacheable', () => {
  const prompt = buildScorePrompt('JOB-BESCHREIBUNG', 'LEBENSLAUF-TEXT', null, PROFILE)
  const idxResume = prompt.indexOf('LEBENSLAUF-TEXT')
  const idxPrefs = prompt.indexOf('WERTPREFERENZEN')
  const idxRules = prompt.indexOf('Berücksichtige dabei:')
  const idxJob = prompt.indexOf('JOB-BESCHREIBUNG')
  assert.ok(idxPrefs > idxResume, 'Präferenzen stehen im nutzerkonstanten Präfix — nach dem Lebenslauf')
  assert.ok(idxPrefs < idxRules, 'und vor den Bewertungsregeln')
  assert.ok(idxPrefs < idxJob, 'und weit vor der wechselnden Anzeige')
  assert.match(prompt, /Tech-Stack \(hoch\)/)
  assert.match(prompt, /moderner JS-Stack/)
  assert.match(prompt, /Meidet: Bereitschaftsdienst/)
  assert.match(prompt, /Die Wertpräferenzen oben gelten/)
})

test('score prompt keeps salary and preferences combinable — salary stays rule 5', () => {
  const prompt = buildScorePrompt('JOB', 'LEBENSLAUF', 45000, PROFILE)
  assert.match(prompt, /5\. Gehaltsvorstellung/)
  assert.ok(!prompt.includes('6. '), 'die Präferenz-Regel ist bewusst unnummeriert')
})

test('score prompt has no preference residue when none exist', () => {
  const prompt = buildScorePrompt('JOB', 'LEBENSLAUF', null)
  assert.ok(!prompt.includes('WERTPREFERENZEN'))
  assert.ok(!prompt.includes('Die Wertpräferenzen oben gelten'))
})

test('semantic ranking prompt condenses preferences to a short block', () => {
  const withPrefs = buildSemanticRankingPrompt('LEBENSLAUF', 'QUERY', [], PROFILE)
  const without = buildSemanticRankingPrompt('LEBENSLAUF', 'QUERY', [])
  assert.match(withPrefs, /PREFERENZEN DES NUTZERS/)
  assert.match(withPrefs, /Frontend mit Backend-Ambitionen/)
  assert.match(withPrefs, /Tech-Stack/)
  assert.match(withPrefs, /PREFERENZEN DES NUTZERS[\s\S]*VERFÜGBARE JOBS/, 'Block steht vor der Jobliste')
  assert.equal(without, buildSemanticRankingPrompt('LEBENSLAUF', 'QUERY', [], null), 'ohne Profil unverändert')
})

test('search query prompt biases toward preferences and forbids negations', () => {
  const withPrefs = buildSearchQueryPrompt('LEBENSLAUF', 'Entwickler', PROFILE)
  const without = buildSearchQueryPrompt('LEBENSLAUF', 'Entwickler')
  assert.match(withPrefs, /PRÄFERENZEN DES NUTZERS/)
  assert.match(withPrefs, /keine Negationen|Keine Negationen/)
  assert.match(withPrefs, /LEBENSLAUF/)
  assert.ok(!without.includes('PRÄFERENZEN'), 'ohne Profil unverändert')
})
