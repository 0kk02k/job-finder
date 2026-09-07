// Das Anschreiben soll klingen wie die Anzeige, auf die es sich bewirbt:
// Register (Du/Sie), Wortschatz und Tonalität aus der Stellenanzeige.
// Getestet wird der Prompt-Vertrag — die KI selbst ist außen vor (lokal kein Key).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCoverLetterPrompt } from '../../lib/ai'

const AD_DU_FORM = 'Dein Profil: Du liebst Kaffee und bringst Deine Ideen ein. Wir bieten dir ein starkes Team.'

test('prompt instructs the AI to mirror the ad’s Du/Sie register', () => {
  const prompt = buildCoverLetterPrompt('LEBENSLAUF', AD_DU_FORM, 'Firma', 'Barista')
  assert.match(prompt, /Du-?\/?Sie-Form|Ansprache der Anzeige|gleiche Ansprache/)
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
