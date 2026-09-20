// Tests für den Lebenslauf-Parser: Ein echter, hochgeladener Lebenslauf ist
// Klartext aus der PDF-Extraktion — kein Markdown. Der Parser muss daraus
// Struktur ziehen und darf niemals ein leeres Dokument zulassen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseResumeMarkdown, resumeDataHasSubstance, generateCoverLetterFromJob, resumeDateRange } from '../../lib/pdf'

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

// Reale PDF-Extraktion (anonymisiert): Datums-Artefakte im Kopf, hart
// umgebrochene Sätze, Abschnitte mit Zusätzen („Kenntnisse & Fähigkeiten"),
// Skills als „Label␣␣Wert"-Zeilen, Detailzeilen mit Doppelpunkt in der Bildung.
const REAL_SHAPE_RESUME = [
  '2025 – Heute',
  '2025 – 2026',
  '2026',
  'Alex Beispiel',
  'Software Engineer & Fachinformatiker für Daten- und Prozessanalyse',
  'Profil',
  'Ausgelernter Fachinformatiker für Daten- und Prozessanalyse mit einem',
  'Hintergrund in Psychologie. Spezialisiert auf lokale KI-Anwendungen,',
  'Automatisierung von Workflows und robuste Linux-Server-Infrastrukturen.',
  'Ausgewählte Projekte & Erfahrung',
  'Entwicklung lokaler KI-Workflows & Automatisierung',
  'Implementierung und Provisionierung isolierter lokaler Agent-Runtimes (Hermes, Vix',
  'CLI).',
  'Nutzung von LLMs für automatisierte Skriptverarbeitung und Workflow-',
  'Optimierung.',
  'Infrastruktur & Server-Management',
  'Konzeption und Aufbau eines Bare-Metal Home-Server-Stacks (16GB RAM',
  'Upgrade).',
  'Kenntnisse & Fähigkeiten',
  'Betriebssysteme Linux (Ubuntu, Pop!_OS, Zorin OS), SteamOS',
  'Technologien & Tools Docker, Git, CLI, ARM64/x86 Architekturen (z.B. LM Studio auf',
  'ARM64)',
  'Bildung',
  'Ausbildung zum Fachinformatiker',
  'Fachrichtung: Daten- und Prozessanalyse (ausgelernt)',
  'Universitätsstudium',
  'Studiengang: Psychologie (Abschluss: Bachelor)',
].join('\n')

test('real shape: name and title from the header block, date artifacts ignored', () => {
  const data = parseResumeMarkdown(REAL_SHAPE_RESUME)
  assert.equal(data.name, 'Alex Beispiel')
  assert.equal(data.title, 'Software Engineer & Fachinformatiker für Daten- und Prozessanalyse')
})

test('real shape: profile stays the profile — no swallowed sections', () => {
  const data = parseResumeMarkdown(REAL_SHAPE_RESUME)
  assert.match(data.summary, /^Ausgelernter Fachinformatiker/)
  assert.match(data.summary, /Linux-Server-Infrastrukturen\.$/)
  assert.ok(!data.summary.includes('Hermes'), 'Projekt-Inhalte dürfen nicht im Profil landen')
  assert.ok(!data.summary.includes('Kenntnisse'), 'Folge-Abschnitte dürfen nicht im Profil landen')
})

test('real shape: project sub-headings become experience entries with merged bullet text', () => {
  const data = parseResumeMarkdown(REAL_SHAPE_RESUME)
  assert.equal(data.experience.length, 2)
  assert.equal(data.experience[0].title, 'Entwicklung lokaler KI-Workflows & Automatisierung')
  assert.deepEqual(data.experience[0].description, [
    'Implementierung und Provisionierung isolierter lokaler Agent-Runtimes (Hermes, Vix CLI).',
    'Nutzung von LLMs für automatisierte Skriptverarbeitung und Workflowoptimierung.',
  ])
  assert.equal(data.experience[1].title, 'Infrastruktur & Server-Management')
  // Keine erfundenen Zeiträume an projektförmigen Einträgen
  assert.equal(data.experience[0].startDate, '')
})

test('real shape: label skills keep their commas inside parentheses intact', () => {
  const data = parseResumeMarkdown(REAL_SHAPE_RESUME)
  assert.ok(data.skills.includes('Betriebssysteme: Linux (Ubuntu, Pop!_OS, Zorin OS), SteamOS'))
  assert.ok(data.skills.includes('Technologien & Tools: Docker, Git, CLI, ARM64/x86 Architekturen (z.B. LM Studio auf ARM64)'))
})

test('real shape: education detail lines attach to their entry', () => {
  const data = parseResumeMarkdown(REAL_SHAPE_RESUME)
  assert.equal(data.education.length, 2)
  assert.match(data.education[0].degree, /^Ausbildung zum Fachinformatiker · Fachrichtung:/)
  assert.match(data.education[1].degree, /^Universitätsstudium · Studiengang: Psychologie/)
})

test('plain skills split on commas, but not inside parentheses', () => {
  const data = parseResumeMarkdown('Kenntnisse\n- React (inkl. Hooks, Context)\n- Node.js')
  assert.deepEqual(data.skills, ['React (inkl. Hooks, Context)', 'Node.js'])
})

test('static cover letter template follows the ad language (English variant)', () => {
  const resume = parseResumeMarkdown(PLAIN_TEXT_RESUME)
  const letter = generateCoverLetterFromJob(resume, 'We are hiring a software engineer.', 'ACME Ltd', 'Software Engineer', 'en')
  assert.match(letter.salutation, /^Dear /)
  assert.match(letter.body[0], /ACME Ltd/)
  assert.match(letter.closing, /Sincerely|Best regards/)
  assert.ok(!letter.body.join(' ').match(/\bIch\b/), 'englische Vorlage darf keine deutschen Sätze enthalten')
})

test('static cover letter template stays German for German ads', () => {
  const resume = parseResumeMarkdown(PLAIN_TEXT_RESUME)
  const letter = generateCoverLetterFromJob(resume, 'Wir suchen eine Softwareentwicklerin.', 'ACME GmbH', 'Softwareentwickler', 'de')
  assert.match(letter.salutation, /^Sehr geehrte/)
  assert.match(letter.closing, /Mit freundlichen Grüßen/)
})

// Datumszeile im Lebenslauf: „03/2021Heute“ war der sichtbare Bug — die
// Renderer-Verkettung verschluckte den Strich. Eine Funktion, ein Vertrag.
test('resumeDateRange baut die Zeile mit Strich und Heute-Ersatz', () => {
  assert.equal(resumeDateRange('03/2021', '02/2024'), '03/2021 – 02/2024')
  assert.equal(resumeDateRange('03/2021'), '03/2021 – Heute')
  assert.equal(resumeDateRange('03/2021', undefined), '03/2021 – Heute')
  assert.equal(resumeDateRange('', '2021'), '2021')
  assert.equal(resumeDateRange(''), '')
})

// Anschreiben ohne Betreff und ohne erreichbare Absenderin sind
// unvollständige Bewerbungsunterlagen — beides gehört auf das Blatt
const CONTACT_RESUME = {
  name: 'Max Mustermann',
  title: 'Datenanalyst',
  email: 'max@mustermann.de',
  phone: '+49 170 1234567',
  location: 'Berlin',
  summary: '',
  experience: [],
  education: [],
  skills: ['SQL'],
}

test('generateCoverLetterFromJob setzt Betreff und Kontaktzeile (de)', () => {
  const letter = generateCoverLetterFromJob(CONTACT_RESUME, 'Sie analysieren Daten bei uns.', 'Muster GmbH', 'Datenanalyst', 'de')
  assert.equal(letter.subject, 'Bewerbung als Datenanalyst')
  assert.equal(letter.contactLine, 'max@mustermann.de · +49 170 1234567 · Berlin')
})

test('generateCoverLetterFromJob ohne Titel: schlichter Betreff (de)', () => {
  const letter = generateCoverLetterFromJob({ ...CONTACT_RESUME, title: '' }, 'Sie analysieren Daten bei uns.', 'Muster GmbH', '', 'de')
  assert.equal(letter.subject, 'Bewerbung')
})

test('generateCoverLetterFromJob setzt Betreff auf Englisch', () => {
  const letter = generateCoverLetterFromJob(CONTACT_RESUME, 'You analyse data with us.', 'Muster GmbH', 'Data Analyst', 'en')
  assert.equal(letter.subject, 'Application as Data Analyst')
})
