// Spracherkennung für Stellenanzeigen und Lebensläufe: Sie entscheidet nur,
// OB übersetzt wird — offline und deterministisch. Deutsch ist der Default
// (Produktmarkt), Gleichstand zählt als Deutsch.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectLanguage } from '../../lib/language'

const GERMAN_AD =
  'Wir suchen eine Fachinformatikerin für unsere Berliner Niederlassung. ' +
  'Zu Ihren Aufgaben gehören die Betreuung unserer Server und die Entwicklung interner Werkzeuge. ' +
  'Wir bieten einen sicheren Arbeitsplatz und ein motiviertes Team.'

const ENGLISH_AD =
  'We are looking for a software engineer to join our platform team in London. ' +
  'You will design and build backend services, work with product managers and ship features weekly. ' +
  'We offer a competitive salary, equity and a flexible hybrid setup.'

test('detects a German job ad', () => {
  assert.equal(detectLanguage(GERMAN_AD), 'de')
})

test('detects an English job ad', () => {
  assert.equal(detectLanguage(ENGLISH_AD), 'en')
})

test('defaults to German on empty or inconclusive text', () => {
  assert.equal(detectLanguage(''), 'de')
  assert.equal(detectLanguage('   '), 'de')
  assert.equal(detectLanguage('C# .NET SQL'), 'de')
})

test('umlauts count as strong German evidence', () => {
  assert.equal(detectLanguage('Wir suchen dich für eine Stelle mit Führungsverantwortung'), 'de')
})
