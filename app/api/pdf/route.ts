import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateResumePDF, generateCoverLetterPDF, parseResumeMarkdown, generateCoverLetterFromJob } from '@/lib/pdf'
import { writeFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'

// POST /api/pdf/resume - generate resume PDF
export async function POSTResume(request: NextRequest) {
  const userId = 'default'

  const body = await request.json()
  const { resumeId } = body

  // Get resume
  const resume = await prisma.resume.findFirst({
    where: { userId, isActive: true },
  })

  if (!resume) {
    return NextResponse.json({ error: 'No resume found' }, { status: 404 })
  }

  try {
    // Parse markdown to structured data
    const resumeData = parseResumeMarkdown(resume.content)

    // Generate PDF
    const outputPath = `/tmp/resume_${Date.now()}.pdf`
    await generateResumePDF(resumeData, outputPath)

    // Read PDF and return as base64
    const pdfBuffer = await import('fs').then(fs => fs.readFileSync(outputPath))

    // Clean up
    await unlink(outputPath)

    // Return PDF
    return new NextResponse(pdfBuffer, {
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

// POST /api/pdf/coverletter - generate cover letter PDF
export async function POSTCoverLetter(request: NextRequest) {
  const userId = 'default'

  const body = await request.json()
  const { jobId } = body

  // Get resume
  const resume = await prisma.resume.findFirst({
    where: { userId, isActive: true },
  })

  if (!resume) {
    return NextResponse.json({ error: 'No resume found' }, { status: 404 })
  }

  // Get job
  const job = await prisma.job.findUnique({
    where: { id: jobId },
  })

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  try {
    // Parse resume
    const resumeData = parseResumeMarkdown(resume.content)

    // Generate cover letter
    const coverLetterData = generateCoverLetterFromJob(resumeData, job.description, job.company || 'Firma')

    // Generate PDF
    const outputPath = `/tmp/cover_${Date.now()}.pdf`
    await generateCoverLetterPDF(coverLetterData, outputPath)

    // Read PDF
    const pdfBuffer = await import('fs').then(fs => fs.readFileSync(outputPath))

    // Clean up
    await unlink(outputPath)

    // Return PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Cover_Letter_${job.company?.replace(/\s+/g, '_')}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Cover letter PDF error:', error)
    return NextResponse.json({ error: 'Failed to generate cover letter' }, { status: 500 })
  }
}

// Main route handler
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { type } = body

  if (type === 'resume') {
    return POSTResume(request)
  } else if (type === 'coverletter') {
    return POSTCoverLetter(request)
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}

// GET /api/pdf - get available PDFs
export async function GET() {
  // List available PDF templates
  return NextResponse.json({
    templates: [
      { id: 'modern', name: 'Modern Single Column' },
      { id: 'classic', name: 'Classic Single Column' },
      { id: 'two-column', name: 'Two Column' },
    ],
  })
}
