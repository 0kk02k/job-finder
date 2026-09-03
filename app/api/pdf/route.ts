import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { generateResumePDF, generateCoverLetterPDF, parseResumeMarkdown, generateCoverLetterFromJob, type CoverLetterData } from '@/lib/pdf'

// POST /api/pdf - generate resume or cover letter PDF.
// Cover letter nimmt optional `content` entgegen — den bearbeiteten Text aus der
// Vorschau auf dem Job-Detail. Ohne `content` fällt die Route auf die statische
// Vorlage zurück (die KI erzeugt den Text über /api/coverletter).
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const body = await request.json()
  const { type } = body

  if (type === 'resume') {
    return generateResume(userId)
  } else if (type === 'coverletter') {
    return generateCoverLetter(userId, body.jobId, body.content)
  } else if (type === 'coverletter-template') {
    return coverLetterTemplate(userId, body.jobId)
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}

async function generateResume(userId: string) {
  const resume = await prisma.resume.findFirst({
    where: { userId, isActive: true },
  })

  if (!resume) {
    return NextResponse.json({ error: 'No resume found' }, { status: 404 })
  }

  try {
    const resumeData = parseResumeMarkdown(resume.content)
    const pdfBuffer = await generateResumePDF(resumeData)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${resume.name.replace(/\s+/g, '_')}_Resume.pdf"`,
      },
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}

async function generateCoverLetter(userId: string, jobId: string, content?: string) {
  const resume = await prisma.resume.findFirst({
    where: { userId, isActive: true },
  })

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
    const coverLetterData =
      content && content.trim().length > 0
        ? coverLetterDataFromText(content, resumeData.name, company)
        : generateCoverLetterFromJob(resumeData, job.description ?? '', company, job.title)
    const pdfBuffer = await generateCoverLetterPDF(coverLetterData)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Anschreiben_${company.replace(/\s+/g, '_').replace(/["\\]/g, '')}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Cover letter PDF error:', error)
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
  const letter = generateCoverLetterFromJob(resumeData, job.description ?? '', job.company || 'Firma', job.title)
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

// GET /api/pdf - get available PDF templates
export async function GET() {
  return NextResponse.json({
    templates: [
      { id: 'modern', name: 'Modern Single Column' },
      { id: 'classic', name: 'Classic Single Column' },
    ],
  })
}
