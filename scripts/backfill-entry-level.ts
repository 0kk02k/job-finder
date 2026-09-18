// Einmal-Backfill: bereits gespeicherte Jobs mit Werkstudent-/Praktikums-Signalen
// und Score > 3 auf den gedeckelten Score 3 setzen (gleicher Vertrag wie scoreJob).
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { entryLevelRoleVerdict } from '../lib/ai'

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
  })
  const jobs = await prisma.job.findMany({
    where: { score: { not: null } },
    select: { id: true, title: true, description: true, score: true },
  })
  let touched = 0
  for (const job of jobs) {
    if ((job.score ?? 0) <= 3) continue
    const verdict = entryLevelRoleVerdict(job.title, job.description)
    if (!verdict) continue
    await prisma.job.update({
      where: { id: job.id },
      data: {
        score: verdict.score,
        scoreReason: verdict.reason,
        matchDetails: JSON.stringify({ strengths: [], gaps: [] }),
      },
    })
    touched++
    console.log(`#${job.score} -> ${verdict.score}: ${job.title}`)
  }
  console.log(`\nBackfill fertig: ${touched} von ${jobs.length} bewerteten Jobs angepasst.`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
