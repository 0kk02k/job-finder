import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { extractText } from 'unpdf'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'Keine Datei' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const fileName = file.name.replace(/\.[^.]+$/, '')
  let text = ''

  try {
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      const result = await extractText(buffer, { mergePages: true })
      text = result.text
    } else {
      text = buffer.toString('utf-8')
    }
  } catch {
    return NextResponse.json({ error: 'Datei konnte nicht gelesen werden' }, { status: 422 })
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
