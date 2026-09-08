// Das Anschreiben soll klingen wie die Anzeige, auf die es sich bewirbt:
// Register (Du/Sie), Wortschatz und Tonalität aus der Stellenanzeige.
// Getestet wird der Prompt-Vertrag — die KI selbst ist außen vor (lokal kein Key).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCoverLetterPrompt, buildTranslateResumePrompt } from '../../lib/ai'

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

test('resume translation prompt forbids inventing facts and keeps structure', () => {
  const prompt = buildTranslateResumePrompt('Berufserfahrung\n- 3 Jahre Erfahrung', 'en')
  assert.match(prompt, /[Ee]nglisch|[Ee]nglish/)
  assert.match(prompt, /3 Jahre Erfahrung/)
  assert.match(prompt, /erfinde|keine neuen|do not invent|no new|unverändert|unchanged|exakt|exactly/i)
})
