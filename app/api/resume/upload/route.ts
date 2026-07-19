import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'Keine Datei' }, { status: 400 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const fileName = file.name.replace(/\.[^.]+$/, '')
  let text = ''

  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    try {
      const { extractText } = await import('unpdf')
      const result = await extractText(bytes, { mergePages: true })
      text = result.text
    } catch (err) {
      console.error('PDF extraction error:', err)
      return NextResponse.json({
        error: `PDF konnte nicht gelesen werden: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`,
      }, { status: 422 })
    }
  } else {
    text = new TextDecoder().decode(bytes)
  }

  if (!text.trim()) {
    return NextResponse.json({ error: 'Datei enthält keinen lesbaren Text' }, { status: 422 })
  }

  // Deactivate old resumes
  await prisma.resume.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false },
  })

  // Save new resume
  const resume = await prisma.resume.create({
    data: {
      userId,
      name: fileName,
      content: text,
      isActive: true,
    },
  })

  return NextResponse.json(resume)
}
