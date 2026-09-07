// DOCX-Export für Lebenslauf und Anschreiben — derselbe Datenstand wie die PDFs
// (lib/pdf.ts, lib/pdf-documents.tsx), aber editierbar in Word/LibreOffice.
// Bewusst gleiche Theme-Namen wie die PDF-Renderer: lib/documents.ts ist die Quelle.
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'
import { DEFAULT_DOC_TEMPLATE, type DocTemplateId } from './documents'
import type { ResumeData, CoverLetterData } from './pdf'

// docx rechnet in Half-Points (2 → 1pt); Helvetica ↔ Arial, Times-Roman ↔ Times New Roman
interface DocxTheme {
  font: string
  nameSize: number
  titleSize: number
  baseSize: number
  smallSize: number
  headingSize: number
  nameColor: string
  accentColor: string
  mutedColor: string
  spacingAfter: number
}

// Exportiert für Tests: der Inhalt wird an den Buildern geprüft, nicht am ZIP.
export const DOCX_THEMES: Record<DocTemplateId, DocxTheme> = {
  modern: {
    font: 'Arial',
    nameSize: 56,
    titleSize: 26,
    baseSize: 20,
    smallSize: 18,
    headingSize: 22,
    nameColor: '1E3A8A',
    accentColor: '2563EB',
    mutedColor: '64748B',
    spacingAfter: 160,
  },
  klassisch: {
    font: 'Times New Roman',
    nameSize: 52,
    titleSize: 24,
    baseSize: 21,
    smallSize: 19,
    headingSize: 23,
    nameColor: '1A1A1A',
    accentColor: '1A1A1A',
    mutedColor: '525252',
    spacingAfter: 140,
  },
  kompakt: {
    font: 'Arial',
    nameSize: 44,
    titleSize: 22,
    baseSize: 18,
    smallSize: 16,
    headingSize: 20,
    nameColor: '111827',
    accentColor: '111827',
    mutedColor: '4B5563',
    spacingAfter: 80,
  },
}

// Exportiert für Tests: dieselben Paragraphen, die Packer in das Dokument schreibt.
export function resumeParagraphs(data: ResumeData, t: DocxTheme): Paragraph[] {
  const out: Paragraph[] = [
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: data.name, bold: true, size: t.nameSize, font: t.font, color: t.nameColor })],
    }),
  ]
  if (data.title) {
    out.push(new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: data.title, size: t.titleSize, font: t.font, color: t.mutedColor })],
    }))
  }
  out.push(new Paragraph({
    spacing: { after: t.spacingAfter },
    children: [new TextRun({
      text: [data.email, data.phone, data.location].filter(Boolean).join('  ·  '),
      size: t.smallSize,
      font: t.font,
      color: t.mutedColor,
    })],
  }))

  const sectionTitle = (title: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: t.spacingAfter, after: 80 },
      children: [new TextRun({ text: title.toUpperCase(), bold: true, size: t.headingSize, font: t.font, color: t.nameColor })],
    })

  if (data.summary) {
    out.push(sectionTitle('Profil'))
    out.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: data.summary, size: t.baseSize, font: t.font })] }))
  }

  if (data.experience.length) {
    out.push(sectionTitle('Berufserfahrung'))
    for (const exp of data.experience) {
      out.push(new Paragraph({
        spacing: { after: 20 },
        children: [new TextRun({ text: exp.company, bold: true, size: t.baseSize + 2, font: t.font })],
      }))
      out.push(new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({
          text: [exp.title, [exp.startDate, exp.endDate || 'Heute'].filter(Boolean).join(' – ')].filter(Boolean).join(' · '),
          size: t.smallSize,
          font: t.font,
          color: t.mutedColor,
        })],
      }))
      for (const line of exp.description) {
        out.push(new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 40 },
          children: [new TextRun({ text: line, size: t.smallSize, font: t.font })],
        }))
      }
    }
  }

  if (data.education.length) {
    out.push(sectionTitle('Ausbildung'))
    for (const edu of data.education) {
      out.push(new Paragraph({
        spacing: { after: 20 },
        children: [new TextRun({ text: edu.school, bold: true, size: t.baseSize + 2, font: t.font })],
      }))
      out.push(new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({
          text: [edu.degree, edu.graduationYear].filter(Boolean).join(' · '),
          size: t.smallSize,
          font: t.font,
          color: t.mutedColor,
        })],
      }))
    }
  }

  if (data.skills.length) {
    out.push(sectionTitle('Kenntnisse'))
    out.push(new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: data.skills.join(', '), size: t.baseSize, font: t.font })],
    }))
  }

  return out
}

function letterParagraphs(data: CoverLetterData, t: DocxTheme): Paragraph[] {
  const out: Paragraph[] = [
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: data.name, bold: true, size: t.baseSize, font: t.font })],
    }),
    new Paragraph({
      spacing: { after: t.spacingAfter },
      children: [new TextRun({ text: data.date, size: t.baseSize, font: t.font, color: t.mutedColor })],
    }),
  ]

  const recipientLines = [data.recipientName, data.recipientTitle, data.recipientCompany].filter(Boolean) as string[]
  for (const line of recipientLines) {
    out.push(new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: line, size: t.baseSize, font: t.font })] }))
  }
  out.push(new Paragraph({ spacing: { after: t.spacingAfter }, children: [] }))

  out.push(new Paragraph({
    spacing: { after: t.spacingAfter },
    children: [new TextRun({ text: data.salutation, size: t.baseSize, font: t.font })],
  }))
  for (const para of data.body) {
    out.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 120 },
      children: [new TextRun({ text: para, size: t.baseSize, font: t.font })],
    }))
  }
  out.push(new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: data.closing, size: t.baseSize, font: t.font })] }))
  out.push(new Paragraph({ spacing: { before: 300 }, children: [new TextRun({ text: data.name, size: t.baseSize, font: t.font })] }))

  return out
}

function toDocx(paragraphs: Paragraph[]): Document {
  return new Document({
    sections: [{ properties: {}, children: paragraphs }],
  })
}

export async function renderResumeDocx(data: ResumeData, template: DocTemplateId = DEFAULT_DOC_TEMPLATE): Promise<Buffer> {
  return Buffer.from(await Packer.toBuffer(toDocx(resumeParagraphs(data, DOCX_THEMES[template]))))
}

export async function renderCoverLetterDocx(data: CoverLetterData, template: DocTemplateId = DEFAULT_DOC_TEMPLATE): Promise<Buffer> {
  return Buffer.from(await Packer.toBuffer(toDocx(letterParagraphs(data, DOCX_THEMES[template]))))
}
