// Herkunft von Treffern — Portal-Namen korrekt geschrieben,neutral etikettiert.
// Die Quelle ist Teil der Klick-Entscheidung (Jooble klickt sich anders an als
// Remotive), aber sie ist Material, nicht Bedeutung: ein Badge in Haarkante,
// kein Regnbogen aus neun Tailwind-Paletten.

// Direkte Plattform-Angabe (Suchergebnisse: `platform`-Feld der Scraper)
const PLATFORM_LABELS: Record<string, string> = {
  indeed: 'Indeed',
  linkedin: 'LinkedIn',
  glassdoor: 'Glassdoor',
  ziprecruiter: 'ZipRecruiter',
  xing: 'XING',
  stepstone: 'StepStone',
  jooble: 'Jooble',
  remotive: 'Remotive',
  arbeitnow: 'Arbeitnow',
  arbeitsagentur: 'Arbeitsagentur',
  adzuna: 'Adzuna',
}

export function platformLabel(platform: string | null | undefined): string {
  if (!platform) return 'Quelle unbekannt'
  const key = platform.toLowerCase()
  return PLATFORM_LABELS[key] ?? platform.charAt(0).toUpperCase() + platform.slice(1)
}

// Hostname-basierte Ableitung (Jobs mit `url`, z. B. Dashboard/Detail)
const HOST_LABELS: Record<string, string> = {
  'jooble.org': 'Jooble',
  'adzuna.de': 'Adzuna',
  'adzuna.co.uk': 'Adzuna',
  'adzuna.com': 'Adzuna',
  'remotive.com': 'Remotive',
  'arbeitnow.com': 'Arbeitnow',
  'arbeitsagentur.de': 'Arbeitsagentur',
  'linkedin.com': 'LinkedIn',
  'stepstone.de': 'StepStone',
  'xing.com': 'XING',
  'indeed.com': 'Indeed',
  'glassdoor.de': 'Glassdoor',
  'glassdoor.com': 'Glassdoor',
}

export function sourceLabel(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    const known = Object.keys(HOST_LABELS).find((k) => host === k || host.endsWith(`.${k}`))
    return known ? HOST_LABELS[known] : host
  } catch {
    return null
  }
}
