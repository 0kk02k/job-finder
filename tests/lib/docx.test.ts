// DOCX-Export: dieselben Daten, dieselben Designs wie die PDFs — nur editierbar.
// Die Buffer müssen echte ZIP-Container sein (PK-Magic), Theme-Unterschiede
// müssen sich im Dokument niederschlagen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderResumeDocx, renderCoverLetterDocx, renderResumeTextDocx, resumeParagraphs, DOCX_THEMES, extractDocxText } from '../../lib/docx'
import type { ResumeData, CoverLetterData } from '../../lib/pdf'

const SAMPLE_RESUME: ResumeData = {
  name: 'Max Mustermann',
  title: 'Softwareentwickler',
  email: 'max@mustermann.de',
  phone: '+49 170 1234567',
  location: 'Berlin',
  summary: 'Erfahrung mit Web-Anwendungen.',
  experience: [
    {
      company: 'Tech Solutions GmbH',
      title: 'Softwareentwickler',
      startDate: '01/2020',
      endDate: 'Heute',
      description: ['Web-Anwendungen mit React und TypeScript entwickelt'],
    },
  ],
  education: [{ school: 'TU Berlin', degree: 'B.Sc. Informatik', graduationYear: '2013 – 2016' }],
  skills: ['JavaScript', 'TypeScript', 'React'],
}

const SAMPLE_LETTER: CoverLetterData = {
  name: 'Max Mustermann',
  recipientCompany: 'Tech Solutions GmbH',
  date: '7. September 2026',
  salutation: 'Sehr geehrte Damen und Herren,',
  body: ['mit großem Interesse bewerbe ich mich auf die Stelle als Softwareentwickler.'],
  closing: 'Mit freundlichen Grüßen',
}

test('renders resume and cover letter as valid DOCX containers in every theme', async () => {
  for (const template of ['modern', 'klassisch', 'kompakt'] as const) {
    const resume = await renderResumeDocx(SAMPLE_RESUME, template)
    const letter = await renderCoverLetterDocx(SAMPLE_LETTER, template)
    assert.ok(resume.length > 1000, `resume ${template} too small`)
    assert.ok(letter.length > 1000, `letter ${template} too small`)
    assert.equal(resume.subarray(0, 2).toString('latin1'), 'PK', 'docx ist ein ZIP-Container')
    assert.equal(letter.subarray(0, 2).toString('latin1'), 'PK', 'docx ist ein ZIP-Container')
  }
})

test('resume content is actually present in the built paragraphs', () => {
  // Die DOCX-Datei ist ein ZIP — der Inhalt liegt komprimiert. Deshalb wird der
  // Inhalt an den Paragraph-Buildern geprüft, die in das Dokument eingehen.
  const text = JSON.stringify(resumeParagraphs(SAMPLE_RESUME, DOCX_THEMES.modern))
  assert.ok(text.includes('Mustermann'), 'Name fehlt')
  assert.ok(text.includes('Tech Solutions'), 'Berufserfahrung fehlt')
  assert.ok(text.includes('React und TypeScript'), 'Stichpunkte fehlen')
})

test('themes produce different documents', async () => {
  const modern = await renderResumeDocx(SAMPLE_RESUME, 'modern')
  const klassisch = await renderResumeDocx(SAMPLE_RESUME, 'klassisch')
  assert.notEqual(modern.length, klassisch.length)
})

// Abschnitts-Labels folgen der Dokumentsprache — ein übersetzter Lebenslauf
// rendert keine deutschen Köpfe, und PDF/DOCX nennen dieselbe Sektion gleich.
test('section labels follow the document language', () => {
  const german = JSON.stringify(resumeParagraphs(SAMPLE_RESUME, DOCX_THEMES.modern))
  assert.ok(german.includes('KENNTNISSE'), 'deutsches Dokument sagt Kenntnisse')
  assert.ok(german.includes('BERUFSERFAHRUNG'))

  const english: ResumeData = {
    ...SAMPLE_RESUME,
    summary: 'Experienced web developer with a strong background in modern applications.',
    experience: [
      {
        company: 'Tech Solutions GmbH',
        title: 'Software Developer',
        startDate: '01/2020',
        endDate: 'present',
        description: ['Built web applications with React and TypeScript'],
      },
    ],
    education: [{ school: 'TU Berlin', degree: 'B.Sc. Computer Science', graduationYear: '2013 – 2016' }],
  }
  const en = JSON.stringify(resumeParagraphs(english, DOCX_THEMES.modern))
  assert.ok(en.includes('PROFILE'), 'englisches Dokument sagt Profile')
  assert.ok(en.includes('EXPERIENCE'))
  assert.ok(en.includes('EDUCATION'))
  assert.ok(en.includes('SKILLS'))
  assert.ok(!en.includes('BERUFSERFAHRUNG'), 'keine deutschen Köpfe im englischen Dokument')
})

// Sichtbarer Text eines Paragraphen über den XML-Baum — Strings sind dort die
// Blätter. Ein Paragraph ohne Blatt wäre eine sichtbare Leerzeile im Dokument.
function paragraphText(p: unknown): string {
  const walk = (node: unknown): string => {
    if (typeof node === 'string') return node
    if (Array.isArray(node)) return node.map(walk).join('')
    if (node && typeof node === 'object' && 'root' in (node as Record<string, unknown>)) {
      return walk((node as Record<string, unknown>).root)
    }
    return ''
  }
  return walk((p as { root?: unknown }).root).trim()
}

// Leere Kopfzeilen sind sichtbare Löcher im Dokument — fehlt Name oder Kontakt,
// wird die Zeile weggelassen statt leer gesetzt.
test('missing name or contact lines leave no empty paragraphs', () => {
  const stripped: ResumeData = { ...SAMPLE_RESUME, name: '', email: '', phone: '', location: '' }
  const empties = resumeParagraphs(stripped, DOCX_THEMES.modern).filter((p) => paragraphText(p) === '')
  assert.deepEqual(empties, [], 'keine leeren Paragraphen im Kopf')
})

test('education entry without school leaves no empty paragraph', () => {
  const data: ResumeData = { ...SAMPLE_RESUME, education: [{ school: '', degree: 'B.Sc. Informatik', graduationYear: '' }] }
  const empties = resumeParagraphs(data, DOCX_THEMES.modern).filter((p) => paragraphText(p) === '')
  assert.deepEqual(empties, [], 'keine leeren Paragraphen in der Ausbildung')
})

test('project-style entries without dates get no invented „Heute"', () => {
  const data: ResumeData = {
    ...SAMPLE_RESUME,
    experience: [{ company: '', title: 'Projekt A', startDate: '', endDate: '', description: ['Dinge getan.'] }],
  }
  const text = JSON.stringify(resumeParagraphs(data, DOCX_THEMES.modern))
  assert.ok(!text.includes('Heute'), 'ohne Zeitraum darf kein „Heute" erscheinen')
})

// Nie-leer-Vertrag auch editierbar: Unparsebarer Lebenslauf + DOCX-Download
// muss eine echte DOCX sein — kein PDF-Byteberg mit falscher Endung.
test('renders raw-text resume as a real DOCX container', async () => {
  const buffer = await renderResumeTextDocx('Ein Absatz ohne erkennbare Struktur.\nZweite Zeile.')
  assert.ok(buffer.length > 1000)
  assert.equal(buffer.subarray(0, 2).toString('latin1'), 'PK', 'docx ist ein ZIP-Container')
})

// Upload-Richtung: extractDocxText muss zurücklesen, was der Export schreibt —
// Absätze bleiben Zeilen, Entitäten sind decodiert.
test('extractDocxText reads back paragraphs and decodes entities', async () => {
  const buffer = await renderResumeTextDocx('Erster Absatz.\nZweite Zeile mit <Spitzen> & "Entitäten".')
  const text = await extractDocxText(new Uint8Array(buffer))
  assert.ok(text.includes('Erster Absatz.'), 'Absatz 1 fehlt')
  assert.ok(text.includes('Zweite Zeile mit <Spitzen> & "Entitäten".'), 'Entitäten nicht decodiert')
})

test('extractDocxText rejects non-docx bytes instead of returning garbage', async () => {
  await assert.rejects(() => extractDocxText(new Uint8Array([1, 2, 3, 4])))
})
