// Das Anschreiben soll klingen wie die Anzeige, auf die es sich bewirbt:
// Register (Du/Sie), Wortschatz und Tonalität aus der Stellenanzeige.
// Getestet wird der Prompt-Vertrag — die KI selbst ist außen vor (lokal kein Key).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCoverLetterPrompt, buildScorePrompt, buildTranslateResumePrompt } from '../../lib/ai'

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

test('resume translation prompt forbids inventing facts and keeps structure', () => {
  const prompt = buildTranslateResumePrompt('Berufserfahrung\n- 3 Jahre Erfahrung', 'en')
  assert.match(prompt, /[Ee]nglisch|[Ee]nglish/)
  assert.match(prompt, /3 Jahre Erfahrung/)
  assert.match(prompt, /erfinde|keine neuen|do not invent|no new|unverändert|unchanged|exakt|exactly/i)
})
