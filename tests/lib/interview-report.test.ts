// Interview-Auswertung als PDF: Der Payload-Builder normalisiert die KI-Insights
// (nur bekannte Kompetenzen, Scores auf 1-5 geklemmt, deutsches Datum), der
// Renderer muss in allen Themes ein echtes, inhaltsvolles PDF liefern.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildInterviewReport, type InterviewReportInput } from '../../lib/pdf'
import { renderInterviewReportPDF } from '../../lib/pdf-documents'

const INPUT: InterviewReportInput = {
  insights: {
    summary: 'Ruhiger, strukturierter Eindruck; Belege waren konkret.',
    strengths: [
      { name: 'Fallanalyse', starExample: 'Beschrieb eine Krise, eigene Rolle und Ergebnis.' },
    ],
    weaknesses: [
      { name: 'Dokumentation', mitigation: 'Feste Dokumentationsblöcke am Vormittag.' },
    ],
    miniTask: {
      task: 'Priorisiere drei Fälle mit knapper Ressource.',
      answer: 'Beginnt mit akuter Gefährdung, begründet nach Schutzprinzip.',
      assessment: 'Gute Begründung, Zeitplan fehlte.',
      scores: { correctness: 4, reasoning: 5, completeness: 2 },
    },
    competencies: { teamwork: 4, communication: 5, problemSolving: 3, selfReflection: 4, erfunden: 9 },
  },
  personalityType: 'INFJ-T',
  date: new Date('2026-09-08T12:00:00Z'),
}

test('payload keeps only known competencies, in fixed order, with labels', () => {
  const report = buildInterviewReport(INPUT)
  assert.deepEqual(
    report.competencies.map((c) => c.label),
    ['Teamwork', 'Kommunikation', 'Problemlösung', 'Selbstreflexion']
  )
  assert.ok(!report.competencies.some((c) => c.label === 'erfunden'))
})

test('payload clamps scores into 1-5 and formats the date in German', () => {
  const report = buildInterviewReport({
    insights: {
      summary: 'x',
      strengths: [],
      weaknesses: [],
      miniTask: null,
      competencies: { teamwork: 99, communication: -3, problemSolving: 4, selfReflection: 2.4 },
    },
    date: new Date('2026-09-08T12:00:00Z'),
  })
  assert.equal(report.competencies.find((c) => c.label === 'Teamwork')?.value, 5)
  assert.equal(report.competencies.find((c) => c.label === 'Kommunikation')?.value, 1)
  assert.equal(report.competencies.find((c) => c.label === 'Selbstreflexion')?.value, 2)
  assert.equal(report.date, '8. September 2026')
})

test('renderer produces a real, content-bearing PDF in every theme', async () => {
  const report = buildInterviewReport(INPUT)
  for (const template of ['modern', 'klassisch', 'kompakt'] as const) {
    const buffer = await renderInterviewReportPDF(report, template)
    assert.ok(buffer.length > 1000, `report ${template} too small`)
    assert.equal(buffer.subarray(0, 5).toString('latin1'), '%PDF-')
  }
})
