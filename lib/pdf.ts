// PDF Export for Resumes and Cover Letters
// Uses @react-pdf/renderer (pure JS, no browser needed)

import { renderResumePDF, renderCoverLetterPDF } from './pdf-documents'

export interface ResumeData {
  name: string
  title: string
  email: string
  phone: string
  location: string
  summary: string
  experience: Array<{
    company: string
    title: string
    startDate: string
    endDate?: string
    description: string[]
  }>
  education: Array<{
    school: string
    degree: string
    graduationYear: string
  }>
  skills: string[]
}

export interface CoverLetterData {
  name: string
  recipientName?: string
  recipientCompany: string
  recipientTitle?: string
  date: string
  salutation: string
  body: string[]
  closing: string
}

// Generate resume PDF as buffer
export const generateResumePDF = renderResumePDF

// Generate cover letter PDF as buffer
export const generateCoverLetterPDF = renderCoverLetterPDF

// Deutsche Lebenslauf-Abschnittstitel → kanonische Sektion. Alles, was nicht
// gemappt wird, ist trotzdem eine Überschrift (endet die aktuelle Sektion),
// damit Flächen wie „Zertifikate" nicht in die Berufserfahrung rutschen.
const SECTION_ALIASES: Record<string, 'profil' | 'erfahrung' | 'ausbildung' | 'skills'> = {
  profil: 'profil',
  'über mich': 'profil',
  profile: 'profil',
  berufserfahrung: 'erfahrung',
  erfahrung: 'erfahrung',
  werdegang: 'erfahrung',
  'beruflicher werdegang': 'erfahrung',
  'berufliche erfahrung': 'erfahrung',
  ausbildung: 'ausbildung',
  bildung: 'ausbildung',
  schullaufbahn: 'ausbildung',
  studium: 'ausbildung',
  kenntnisse: 'skills',
  'it-kenntnisse': 'skills',
  fähigkeiten: 'skills',
  kompetenzen: 'skills',
  skills: 'skills',
  sprachen: 'skills',
}

function isSectionTitleLine(line: string): boolean {
  return line.length <= 60 && !/[.,;:!?]$/.test(line) && line.toLowerCase() in SECTION_ALIASES
}

// Mindestens 7 Ziffern, sonst nur telefontypische Zeichen — „01/2020 – Heute"
// und PLZ-Zeilen fallen durch das ausgeschlossene „/" bzw. „," heraus.
function isPhoneLine(line: string): boolean {
  if (!/^\+?[0-9 ()-]{7,20}$/.test(line)) return false
  return (line.match(/\d/g) ?? []).length >= 7
}

// Nackter Zeitraum wie „01/2020 – Heute" oder „2013 bis 2016": nur Ziffern,
// datumstypische Zeichen und die Zeitwörter „heute"/„bis" — kein Firmenname.
function isDateLine(line: string): boolean {
  if (line.includes('|')) return false
  return /\d/.test(line) && line.replace(/[\d\s/.,:–—-]|heute|bis/gi, '') === ''
}

function splitSkills(line: string): string[] {
  return line.split(',').map((s) => s.trim()).filter(Boolean)
}

// „01/2020 – Heute" → ['01/2020', 'Heute']; ohne Enddatum → ['2019']
function splitDateRange(line: string): [start: string, end: string] {
  const parts = line.split(/–|—|\s-\s|\bbis\b/i).map((p) => p.trim())
  return [parts[0] ?? '', parts[1] ?? '']
}

// Hat das Parsing genug hergegeben, um daraus ein Dokument zu rendern? Falls
// nicht, rendert die Route den Rohtext — nie ein leeres PDF.
export function resumeDataHasSubstance(data: ResumeData): boolean {
  return Boolean(
    data.name || data.title || data.email || data.phone || data.summary ||
      data.experience.length || data.education.length || data.skills.length
  )
}

// Parse resume markdown to structured data. Hochgeladene Lebensläufe sind in
// der Regel Klartext aus der PDF-Extraktion — Markdown-Struktur (das
// Bearbeiten-Feld auf /resume) hat Vorrang, sonst greift der Klartext-Pfad.
export function parseResumeMarkdown(markdown: string): ResumeData {
  if (/(^|\n)#{1,3}\s/.test(markdown)) {
    return parseStructuredResume(markdown)
  }
  return parsePlainTextResume(markdown)
}

function emptyResumeData(): ResumeData {
  return {
    name: '',
    title: '',
    email: '',
    phone: '',
    location: '',
    summary: '',
    experience: [],
    education: [],
    skills: [],
  }
}

function parseStructuredResume(markdown: string): ResumeData {
  const lines = markdown.split('\n')
  const data = emptyResumeData()

  let currentSection: string | null = null
  type ExperienceItem = ResumeData['experience'][number]
  type EducationItem = ResumeData['education'][number]
  let currentItem: ExperienceItem | EducationItem | null = null

  for (const line of lines) {
    if (line.startsWith('# ')) {
      data.name = line.substring(2).trim()
    } else if (line.startsWith('## ')) {
      currentSection = line.substring(2).trim().toLowerCase()
    } else if (line.startsWith('### ')) {
      const title = line.substring(3).trim()
      if (currentSection === 'erfahrung' || currentSection === 'experience') {
        currentItem = { title, company: '', startDate: '', description: [] }
        data.experience.push(currentItem)
        // Berufsbezeichnung für Anschreiben/Textbausteine: der erste Erfahrungstitel
        // ist die ehrlichste Selbstauskunft, die der Lebenslauf hergibt
        if (!data.title) data.title = title
      } else if (currentSection === 'ausbildung' || currentSection === 'education') {
        currentItem = { degree: title, school: '', graduationYear: '' }
        data.education.push(currentItem)
      }
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const content = line.substring(2).trim()
      if (currentItem && currentSection === 'skills') {
        data.skills.push(content)
      } else if (currentItem && 'description' in currentItem) {
        currentItem.description.push(content)
      }
    } else if (line.trim()) {
      if (line.includes('@') && !data.email) {
        data.email = line.trim()
      } else if (line.includes('+') && !data.phone) {
        data.phone = line.trim()
      } else if (line.includes('📍') && !data.location) {
        data.location = line.replace('📍', '').trim()
      } else if (currentSection === 'profil') {
        data.summary = data.summary ? `${data.summary} ${line.trim()}` : line.trim()
      }
      if (currentItem && currentSection === 'erfahrung' && 'company' in currentItem) {
        if (line.includes('|')) {
          const parts = line.split('|').map(p => p.trim())
          if (parts[0]) currentItem.company = parts[0]
          if (parts[1]) currentItem.startDate = parts[1]
          if (parts[2]) currentItem.endDate = parts[2]
        }
      }
    }
  }

  return data
}

// Klartext-Lebenslauf aus der PDF-Extraktion: kein Markdown, aber erkennbare
// Struktur — Kontaktkopf, Überschriftenzeilen, Einträge als Titelzeile plus
// „Firma | Von – Bis", Bullets als •/-/*. Heuristik, kein Silberstreifen:
// Was nicht erkannt wird, fließt nicht in das strukturierte Dokument — die
// Route fängt das über resumeDataHasSubstance und rendert dann den Rohtext.
function parsePlainTextResume(text: string): ResumeData {
  const data = emptyResumeData()
  let section: 'profil' | 'erfahrung' | 'ausbildung' | 'skills' | 'sonstiges' | null = null
  let experience: ResumeData['experience'][number] | null = null
  let education: ResumeData['education'][number] | null = null
  // Titel- bzw. Abschluss-Kandidat, der auf seine „Firma | Zeitraum"-Zeile wartet
  let pendingExperienceTitle = ''
  let pendingEducationDegree = ''
  let firstLine = true

  const flushPendingExperience = (): ResumeData['experience'][number] | null => {
    if (pendingExperienceTitle) {
      experience = { title: pendingExperienceTitle, company: '', startDate: '', description: [] }
      data.experience.push(experience)
      if (!data.title) data.title = pendingExperienceTitle
      pendingExperienceTitle = ''
      return experience
    }
    return experience
  }
  const flushPendingEducation = (): ResumeData['education'][number] | null => {
    if (pendingEducationDegree) {
      education = { degree: pendingEducationDegree, school: '', graduationYear: '' }
      data.education.push(education)
      pendingEducationDegree = ''
      return education
    }
    return education
  }

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    // Abschnittsüberschrift — beendet Eintrag und Sektion
    if (isSectionTitleLine(line)) {
      flushPendingExperience()
      flushPendingEducation()
      experience = null
      education = null
      section = SECTION_ALIASES[line.toLowerCase()] ?? 'sonstiges'
      continue
    }

    // Kontaktzeilen, wo immer sie stehen
    if (!data.email && /\S+@\S+\.\S+/.test(line)) {
      data.email = line
      continue
    }
    if (!data.phone && isPhoneLine(line)) {
      data.phone = line
      continue
    }
    if (!data.location) {
      const city = line.match(/\b\d{5}\s+([A-ZÄÖÜ][a-zäöüß-]+)/)
      if (city) {
        data.location = city[1]
        continue
      }
    }

    // Name: erste Zeile vor jeder Sektion — kurz und ohne Satzeichen/Ziffern,
    // damit kein Fließtext zum Namen erklärt wird (Abkürzungen wie „Dr." opfert
    // die Heuristik bewusst; sie kostet sonst das Nie-leer-Fallback)
    if (firstLine) {
      firstLine = false
      if (!section && !/[.,;:!?@]|\d/.test(line) && line.split(/\s+/).length <= 6) {
        data.name = line
        continue
      }
    }

    // Bullets: • · ▪ ◦ * -
    const bullet = line.match(/^[•·▪◦‣]\s+(.*)$/) ?? line.match(/^[-*]\s+(.*)$/)
    if (bullet) {
      const content = bullet[1].trim()
      if (section === 'erfahrung' && experience) {
        experience.description.push(content)
      } else if (section === 'skills') {
        data.skills.push(content)
      }
      continue
    }

    if (section === 'profil') {
      data.summary = data.summary ? `${data.summary} ${line}` : line
      continue
    }

    if (section === 'skills') {
      data.skills.push(...splitSkills(line))
      continue
    }

    if (section === 'erfahrung') {
      if (line.includes('|') && /\d/.test(line)) {
        // „Firma | Von – Bis" — macht den wartenden Titel zum Eintrag
        const current = flushPendingExperience()
        const parts = line.split('|').map((p) => p.trim())
        if (current) {
          if (parts[0] && !current.company) current.company = parts[0]
          const [start, end] = splitDateRange(parts[1] ?? '')
          if (start) current.startDate = start
          if (parts[2]) current.endDate = parts[2]
          else if (end) current.endDate = end
        }
      } else if (isDateLine(line) && pendingExperienceTitle) {
        // nackter Zeitraum unter dem Titel — Firma fehlt
        const range = line.split(/–|—|\s-\s|\bbis\b/i)
        experience = { title: pendingExperienceTitle, company: '', startDate: range[0]?.trim() ?? '', endDate: range[1]?.trim() ?? '', description: [] }
        data.experience.push(experience)
        if (!data.title) data.title = pendingExperienceTitle
        pendingExperienceTitle = ''
      } else if (pendingExperienceTitle) {
        // zweite Titelzeile ohne Firmenzeile — vorherigen Titel als Eintrag sichern
        flushPendingExperience()
        pendingExperienceTitle = line
      } else {
        pendingExperienceTitle = line
      }
      continue
    }

    if (section === 'ausbildung') {
      if (line.includes('|')) {
        const current = flushPendingEducation()
        const parts = line.split('|').map((p) => p.trim())
        if (current) {
          if (parts[0] && !current.school) current.school = parts[0]
          if (parts.length > 1 && !current.graduationYear) current.graduationYear = parts.slice(1).join(' – ')
        }
      } else if (pendingEducationDegree) {
        flushPendingEducation()
        pendingEducationDegree = line
      } else {
        pendingEducationDegree = line
      }
      continue
    }
  }

  flushPendingExperience()
  flushPendingEducation()
  return data
}

// Generate cover letter from job description and resume.
// Vorlage-Fallback (Stufe 1): benennt Job und Beruf ehrlich, statt Floskeln
// mit leerem Berufsfeld auszuliefern. Die KI (generateCoverLetter in lib/ai.ts)
// ist der Primärweg — diese Vorlage ist ausdrücklich als „bitte prüfen" markiert.
export function generateCoverLetterFromJob(
  resumeData: ResumeData,
  jobDescription: string,
  company: string,
  jobTitle: string
): CoverLetterData {
  const today = new Date().toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const role = jobTitle || 'die ausgeschriebene Stelle'
  const profile = resumeData.title
    ? `Als ${resumeData.title} bringe ich Erfahrung mit ${resumeData.skills.slice(0, 3).join(', ')} mit.`
    : `Meine Schwerpunkte liegen in ${resumeData.skills.slice(0, 3).join(', ')}.`

  return {
    name: resumeData.name,
    recipientCompany: company,
    date: today,
    salutation: 'Sehr geehrte Damen und Herren,',
    body: [
      `mit großem Interesse bewerbe ich mich bei ${company} auf die Stelle als ${role}.`,
      `${profile} Wie meine Erfahrung zu Ihren Anforderungen passt, habe ich im Lebenslauf zusammengefasst.`,
      `Über ein persönliches Gespräch, in dem ich meinen Hintergrund erläutern kann, freue ich mich sehr.`,
    ],
    closing: 'Mit freundlichen Grüßen',
  }
}
