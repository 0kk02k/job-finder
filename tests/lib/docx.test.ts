// DOCX-Export: dieselben Daten, dieselben Designs wie die PDFs — nur editierbar.
// Die Buffer müssen echte ZIP-Container sein (PK-Magic), Theme-Unterschiede
// müssen sich im Dokument niederschlagen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderResumeDocx, renderCoverLetterDocx, resumeParagraphs, DOCX_THEMES } from '../../lib/docx'
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
