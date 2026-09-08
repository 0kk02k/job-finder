import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { generateResumePDF, generateCoverLetterPDF, parseResumeMarkdown, generateCoverLetterFromJob, resumeDataHasSubstance, buildInterviewReport, type CoverLetterData, type InterviewReportInput } from '@/lib/pdf'
import { renderResumeTextPDF, renderInterviewReportPDF } from '@/lib/pdf-documents'
import { renderResumeDocx, renderCoverLetterDocx, renderResumeTextDocx } from '@/lib/docx'
import { resolveDocTemplate, DOC_TEMPLATES, type DocTemplateId } from '@/lib/documents'
import { detectLanguage } from '@/lib/language'
import { translateResume, aiConfigFromSettings } from '@/lib/ai'

type ExportFormat = 'pdf' | 'docx'

// Dokumenten-Design serverseitig aus den Settings — der Download-Button fragt
// nicht nach, die Einstellung gilt global (Settings-Seite).
async function docTemplateFor(userId: string): Promise<DocTemplateId> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { docTemplate: true },
  })
  return resolveDocTemplate(settings?.docTemplate)
}

// Lebenslauf in der Sprache der Anzeige: Bei fremdsprachiger Anzeige wird der
// Lebenslauf per KI übersetzt (nur für diesen Download, nichts wird gespeichert).
// Kein stiller Fallback: Schlägt die Übersetzung fehl, gibt es einen ehrlichen
// Fehler statt eines Dokuments in der falschen Sprache.
async function resumeContentForDownload(userId: string, resumeContent: string, jobId?: string): Promise<{ content: string; error?: NextResponse }> {
  if (!jobId) return { content: resumeContent }

  const job = await prisma.job.findFirst({ where: { id: jobId, userId }, select: { description: true } })
  if (!job) return { content: resumeContent }

  const adLanguage = detectLanguage(job.description ?? '')
  const resumeLanguage = detectLanguage(resumeContent)
  if (adLanguage === resumeLanguage) return { content: resumeContent }

  try {
    const settings = await prisma.userSettings.findUnique({ where: { userId } })
    const cfg = aiConfigFromSettings(settings)
    const translated = await translateResume(resumeContent, adLanguage, cfg.provider, cfg.model, cfg.apiKey, cfg.baseUrl)
    return { content: translated }
  } catch (error) {
    console.error('Resume translation error:', error)
    return {
      content: resumeContent,
      error: NextResponse.json(
        { error: 'Der Lebenslauf konnte nicht in die Sprache der Anzeige übersetzt werden — es wurde kein Dokument erzeugt. Deine Daten sind unverändert.' },
        { status: 503 }
      ),
    }
  }
}

// POST /api/pdf - Lebenslauf oder Anschreiben als PDF oder DOCX.
// Cover letter nimmt optional `content` entgegen — den bearbeiteten Text aus der
// Vorschau auf dem Job-Detail. Ohne `content` fällt die Route auf die statische
// Vorlage zurück (die KI erzeugt den Text über /api/coverletter).
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const body = await request.json()
  const { type } = body
  const format: ExportFormat = body.format === 'docx' ? 'docx' : 'pdf'

  if (type === 'resume') {
    return generateResume(userId, format, body.jobId)
  } else if (type === 'coverletter') {
    return generateCoverLetter(userId, body.jobId, format, body.content)
  } else if (type === 'coverletter-template') {
    return coverLetterTemplate(userId, body.jobId)
  } else if (type === 'interview-report') {
    // Die Akte lebt im Client-State — sie kommt als Payload, wird gerendert
    // und nie gespeichert (gleiche Linie wie das Anschreiben)
    if (!body.report || typeof body.report !== 'object') {
      return NextResponse.json({ error: 'Fehlende Auswertungsdaten' }, { status: 400 })
    }
    const report = buildInterviewReport(body.report as InterviewReportInput)
    const template = await docTemplateFor(userId)
    const buffer = await renderInterviewReportPDF(report, template)
    return documentResponse(buffer, format, 'Interview-Auswertung')
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}

function documentResponse(buffer: Buffer, format: ExportFormat, filenameBase: string) {
  const extension = format === 'docx' ? 'docx' : 'pdf'
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': format === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf',
      'Content-Disposition': `attachment; filename="${filenameBase}.${extension}"`,
    },
  })
}

async function generateResume(userId: string, format: ExportFormat, jobId?: string) {
  const [resume, template] = await Promise.all([
    prisma.resume.findFirst({ where: { userId, isActive: true } }),
    docTemplateFor(userId),
  ])

  if (!resume) {
    return NextResponse.json({ error: 'No resume found' }, { status: 404 })
  }

  const { content, error } = await resumeContentForDownload(userId, resume.content, jobId)
  if (error) return error

  try {
    const resumeData = parseResumeMarkdown(content)
    // Nie-leer-Vertrag: Erkennt der Parser keine Struktur, wird der Rohtext
    // gesetzt — eine leere Seite geht nie als „Lebenslauf" raus (im angefragten Format).
    const buffer = resumeDataHasSubstance(resumeData)
      ? format === 'docx'
        ? await renderResumeDocx(resumeData, template)
        : await generateResumePDF(resumeData, template)
      : format === 'docx'
        ? await renderResumeTextDocx(content)
        : await renderResumeTextPDF(content)

    return documentResponse(buffer, format, resume.name.replace(/\s+/g, '_'))
  } catch (error) {
    console.error('Document generation error:', error)
    return NextResponse.json({ error: 'Failed to generate document' }, { status: 500 })
  }
}

async function generateCoverLetter(userId: string, jobId: string, format: ExportFormat, content?: string) {
  const [resume, template] = await Promise.all([
    prisma.resume.findFirst({ where: { userId, isActive: true } }),
    docTemplateFor(userId),
  ])

  if (!resume) {
    return NextResponse.json({ error: 'No resume found' }, { status: 404 })
  }

  const job = await prisma.job.findFirst({
    where: { id: jobId, userId },
  })

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  try {
    const resumeData = parseResumeMarkdown(resume.content)
    const company = job.company || 'Firma'
    const adLanguage = detectLanguage(job.description ?? '')
    const coverLetterData =
      content && content.trim().length > 0
        ? coverLetterDataFromText(content, resumeData.name, company)
        : generateCoverLetterFromJob(resumeData, job.description ?? '', company, job.title, adLanguage)
    const buffer = format === 'docx'
      ? await renderCoverLetterDocx(coverLetterData, template)
      : await generateCoverLetterPDF(coverLetterData, template)

    return documentResponse(
      buffer,
      format,
      `Anschreiben_${company.replace(/\s+/g, '_').replace(/["\\]/g, '')}`
    )
  } catch (error) {
    console.error('Cover letter generation error:', error)
    return NextResponse.json({ error: 'Failed to generate cover letter' }, { status: 500 })
  }
}

// Statische Vorlage als Text (Stufe 1 des Anschreiben-Flows): editierbar in der
// Vorschau, ausdrücklich als „bitte prüfen“ markiert — kein direkter PDF-Download.
async function coverLetterTemplate(userId: string, jobId: string) {
  const [resume, job] = await Promise.all([
    prisma.resume.findFirst({ where: { userId, isActive: true } }),
    prisma.job.findFirst({ where: { id: jobId, userId } }),
  ])

  if (!resume || !job) {
    return NextResponse.json({ error: 'Lebenslauf oder Job nicht gefunden' }, { status: 404 })
  }

  const resumeData = parseResumeMarkdown(resume.content)
  const letter = generateCoverLetterFromJob(
    resumeData,
    job.description ?? '',
    job.company || 'Firma',
    job.title,
    detectLanguage(job.description ?? '')
  )
  return NextResponse.json({ text: [letter.salutation, ...letter.body, letter.closing, letter.name].join('\n\n') })
}

// Bearbeiteter KI-/Vorlage-Text → Briefstruktur: Anrede und Grußformel werden
// erkannt und aus dem Fließtext herausgezogen, damit das PDF sie nicht doppelt
// und falsch formatiert rendert.
function coverLetterDataFromText(text: string, name: string, company: string): CoverLetterData {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n+/g, ' ').trim())
    .filter(Boolean)

  let salutation = ''
  let closing = ''
  if (paragraphs.length > 0 && /^(sehr geehrt|liebe[rn]?\s|hallo)/i.test(paragraphs[0])) {
    salutation = paragraphs.shift() as string
  }
  if (paragraphs.length > 0 && /^(mit freundlichen grüßen|viele grüße|beste grüße)/i.test(paragraphs[paragraphs.length - 1])) {
    closing = paragraphs.pop() as string
  }
  // Eine namensgleiche Zeile hinter der Grußformel ist die Signatur — die rendert das Dokument selbst
  if (paragraphs.length > 0 && paragraphs[paragraphs.length - 1] === name) {
    paragraphs.pop()
  }

  return {
    name,
    recipientCompany: company,
    date: new Date().toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' }),
    salutation: salutation || 'Sehr geehrte Damen und Herren,',
    body: paragraphs,
    closing: closing || 'Mit freundlichen Grüßen',
  }
}

// GET /api/pdf - verfügbare Dokumenten-Designs (echte Liste aus lib/documents.ts)
export async function GET() {
  return NextResponse.json({ templates: DOC_TEMPLATES })
}
