import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { generateResumePDF, generateCoverLetterPDF, parseResumeMarkdown, generateCoverLetterFromJob } from '@/lib/pdf'

// POST /api/pdf - generate resume or cover letter PDF
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const body = await request.json()
  const { type } = body

  if (type === 'resume') {
    return generateResume(userId)
  } else if (type === 'coverletter') {
    return generateCoverLetter(userId, body.jobId)
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

async function generateCoverLetter(userId: string, jobId: string) {
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
    const coverLetterData = generateCoverLetterFromJob(resumeData, job.description, job.company || 'Firma')
    const pdfBuffer = await generateCoverLetterPDF(coverLetterData)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Cover_Letter_${(job.company || 'Anschreiben').replace(/\s+/g, '_').replace(/["\\]/g, '')}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Cover letter PDF error:', error)
    return NextResponse.json({ error: 'Failed to generate cover letter' }, { status: 500 })
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
