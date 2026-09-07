// Der Nie-leer-Vertrag: Ein Lebenslauf, aus dem der Parser nichts Strukturiertes
// ziehen kann, wird als schlichtes Rohtext-Dokument gerendert — nie als leere Seite.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderResumeTextPDF, renderResumePDF, renderCoverLetterPDF } from '../../lib/pdf-documents'
import type { ResumeData, CoverLetterData } from '../../lib/pdf'

test('renders unparseable resume text as a real, non-empty PDF', async () => {
  const buffer = await renderResumeTextPDF('Ein Absatz ohne erkennbare Struktur.\nZweite Zeile mit Inhalt.')
  assert.ok(buffer.length > 1000, `buffer too small: ${buffer.length}`)
  assert.equal(buffer.subarray(0, 5).toString('latin1'), '%PDF-')
})

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

test('renders resume and cover letter in all three themes', async () => {
  for (const template of ['modern', 'klassisch', 'kompakt'] as const) {
    const resume = await renderResumePDF(SAMPLE_RESUME, template)
    const letter = await renderCoverLetterPDF(SAMPLE_LETTER, template)
    assert.ok(resume.length > 1000, `resume ${template} too small`)
    assert.ok(letter.length > 1000, `letter ${template} too small`)
    assert.equal(resume.subarray(0, 5).toString('latin1'), '%PDF-')
    assert.equal(letter.subarray(0, 5).toString('latin1'), '%PDF-')
  }
})

test('themes actually produce different documents', async () => {
  // Times-Roman vs Helvetica betten unterschiedliche Fonts ein — gleiche
  // Bytegröße wäre der Beweis, dass das Theme ignoriert wurde.
  const modern = await renderResumePDF(SAMPLE_RESUME, 'modern')
  const klassisch = await renderResumePDF(SAMPLE_RESUME, 'klassisch')
  assert.notEqual(modern.length, klassisch.length)
})
