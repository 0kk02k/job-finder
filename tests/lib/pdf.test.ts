// Tests für den Lebenslauf-Parser: Ein echter, hochgeladener Lebenslauf ist
// Klartext aus der PDF-Extraktion — kein Markdown. Der Parser muss daraus
// Struktur ziehen und darf niemals ein leeres Dokument zulassen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseResumeMarkdown, resumeDataHasSubstance } from '../../lib/pdf'

// Realistischer unpdf-Extrakt: Kontaktkopf, Abschnitte als Überschriftenzeilen,
// Einträge als Titelzeile + „Firma | Von – Bis", Bullets als •-Zeilen.
const PLAIN_TEXT_RESUME = `Max Mustermann
Musterstraße 1, 12345 Berlin
max@mustermann.de
+49 170 1234567

Profil
Softwareentwickler mit 8 Jahren Erfahrung in Web-Anwendungen.

Berufserfahrung

Softwareentwickler
Tech Solutions GmbH | 01/2020 – Heute
• Entwicklung von Web-Anwendungen mit React und TypeScript
- Führung eines Teams von 3 Entwicklern

Frontend-Entwickler
Web Agency Berlin | 03/2017 – 12/2019
• Umsetzung von Kundenprojekten mit Vue.js

Ausbildung

B.Sc. Informatik
TU Berlin | 2013 – 2016

Kenntnisse
JavaScript, TypeScript, React
Node.js, SQL
`

test('parses plain-text resume: name and contact lines', () => {
  const data = parseResumeMarkdown(PLAIN_TEXT_RESUME)
  assert.equal(data.name, 'Max Mustermann')
  assert.equal(data.email, 'max@mustermann.de')
  assert.equal(data.phone, '+49 170 1234567')
  assert.equal(data.location, 'Berlin')
})

test('parses plain-text resume: profile section becomes summary', () => {
  const data = parseResumeMarkdown(PLAIN_TEXT_RESUME)
  assert.match(data.summary, /8 Jahren Erfahrung/)
})

test('parses plain-text resume: experience entries with company and dates', () => {
  const data = parseResumeMarkdown(PLAIN_TEXT_RESUME)
  assert.equal(data.experience.length, 2)
  assert.equal(data.experience[0].title, 'Softwareentwickler')
  assert.equal(data.experience[0].company, 'Tech Solutions GmbH')
  assert.equal(data.experience[0].startDate, '01/2020')
  assert.equal(data.experience[0].endDate, 'Heute')
  assert.equal(data.experience[1].title, 'Frontend-Entwickler')
  assert.equal(data.experience[1].company, 'Web Agency Berlin')
})

test('parses plain-text resume: bullets land in the current experience entry', () => {
  const data = parseResumeMarkdown(PLAIN_TEXT_RESUME)
  assert.equal(data.experience[0].description.length, 2)
  assert.match(data.experience[0].description[0], /React und TypeScript/)
  assert.equal(data.experience[1].description.length, 1)
})

test('parses plain-text resume: education entry', () => {
  const data = parseResumeMarkdown(PLAIN_TEXT_RESUME)
  assert.equal(data.education.length, 1)
  assert.equal(data.education[0].degree, 'B.Sc. Informatik')
  assert.equal(data.education[0].school, 'TU Berlin')
  assert.equal(data.education[0].graduationYear, '2013 – 2016')
})

test('parses plain-text resume: skills split on commas', () => {
  const data = parseResumeMarkdown(PLAIN_TEXT_RESUME)
  assert.ok(data.skills.includes('JavaScript'))
  assert.ok(data.skills.includes('TypeScript'))
  assert.ok(data.skills.includes('Node.js'))
})

test('parses plain-text resume: first job title becomes the professional title', () => {
  const data = parseResumeMarkdown(PLAIN_TEXT_RESUME)
  assert.equal(data.title, 'Softwareentwickler')
})

test('still parses markdown resumes as before', () => {
  const data = parseResumeMarkdown(
    ['# Anna Beispiel', '## Profil', 'Frontend-Entwicklerin mit Fokus auf Barrierefreiheit.', '## Erfahrung', '### Senior Developer', 'Firma GmbH | 2019 | 2023', '- Dinge gebaut', '## Skills', '- React'].join('\n')
  )
  assert.equal(data.name, 'Anna Beispiel')
  assert.equal(data.summary, 'Frontend-Entwicklerin mit Fokus auf Barrierefreiheit.')
  assert.equal(data.title, 'Senior Developer')
  assert.equal(data.experience[0].company, 'Firma GmbH')
  assert.equal(data.experience[0].description[0], 'Dinge gebaut')
  assert.deepEqual(data.skills, ['React'])
})

test('substance: empty parse has no substance, real parse does', () => {
  assert.equal(resumeDataHasSubstance(parseResumeMarkdown('Ein Absatz ohne erkennbare Struktur.')), false)
  assert.equal(resumeDataHasSubstance(parseResumeMarkdown(PLAIN_TEXT_RESUME)), true)
})
