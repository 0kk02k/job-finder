import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { scrapeJobUrl } from '@/lib/scrapers'
import { scoreJob } from '@/lib/ai'

// Only allow public http(s) URLs — block SSRF against localhost/private/metadata hosts.
function isPublicHttpUrl(rawUrl: string): boolean {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return false
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false

  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' || host.endsWith('.localhost') ||
    host.endsWith('.local') || host.endsWith('.internal') ||
    host === '0.0.0.0' || host === '::1' || host === '[::1]'
  ) {
    return false
  }

  // Block private/reserved IPv4 ranges (node normalizes decimal/hex IP forms already)
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/)
  if (ipv4) {
    const a = Number(ipv4[1])
    const b = Number(ipv4[2])
    if (a === 0 || a === 10 || a === 127) return false
    if (a === 192 && b === 168) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 169 && b === 254) return false
  }

  return true
}

// GET /api/jobs - list all jobs for user
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const jobs = await prisma.job.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(jobs)
}

// POST /api/jobs - add new job (URL or manual)
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const body = await request.json()
  const { url, title, company, location, description } = body

  if (url && !isPublicHttpUrl(url)) {
    return NextResponse.json({ error: 'Ungültige oder nicht erlaubte URL' }, { status: 400 })
  }

  let jobData = { title, company, location, description, url }

  // If URL provided, try to scrape
  if (url && (!title || !description)) {
    const scraped = await scrapeJobUrl(url)
    if (scraped) {
      jobData = { ...jobData, ...scraped }
    }
  }

  // Never store empty jobs (scraping may fail or return nothing useful)
  if (!jobData.title?.trim() || !jobData.description?.trim()) {
    return NextResponse.json(
      { error: 'Die Stellenanzeige konnte nicht gelesen werden. Bitte Titel und Beschreibung manuell eingeben.' },
      { status: 422 }
    )
  }

  let job
  try {
    job = await prisma.job.create({
      data: {
        userId,
        ...jobData,
      },
    })
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'Dieser Job ist bereits in deiner Liste.' }, { status: 409 })
    }
    throw error
  }

  // Auto-score if we have resume
  const resume = await prisma.resume.findFirst({
    where: { userId, isActive: true },
  })

  if (resume && job.description) {
    try {
      const scoreResult = await scoreJob(job.description, resume.content)
      // score is null when the AI was unreachable — keep the job unscored then
      if (scoreResult.score !== null) {
        await prisma.job.update({
          where: { id: job.id },
          data: {
            score: scoreResult.score,
            scoreReason: scoreResult.reason,
            status: scoreResult.score >= 7 ? 'HIGH_MATCH' : 'SCORED',
          },
        })
      }
    } catch (error) {
      console.error('Scoring error:', error)
    }
  }

  return NextResponse.json(job)
}
