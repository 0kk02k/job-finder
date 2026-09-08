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
  'ausgewählte projekte': 'erfahrung',
  projekte: 'erfahrung',
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

// Abschnittstitel erkennen — exakt („Profil") oder mit Zusatz („Kenntnisse &
// Fähigkeiten", „Ausgewählte Projekte & Erfahrung"). Rückgabe ist der passende
// Alias, damit die Sektion auch im Präfix-Fall korrekt aufgelöst wird. Der
// Zusatz-Fall kostet im Zweifel eine inhaltsvolle Zeile, die Alternative
// verschluckt ganze Abschnitte als Fließtext — der Fehlalarm ist der billigere.
function sectionAliasOf(line: string): string | null {
  if (line.length > 60 || /[.!?]$/.test(line)) return null
  const lower = line.toLowerCase()
  return Object.keys(SECTION_ALIASES).find((alias) => lower === alias || lower.startsWith(alias + ' ')) ?? null
}

// Konventionelle Kenntnis-Labels („Betriebssysteme Linux (…)", „Methoden &
// Frameworks Datenanalyse, …"): Die PDF-Extraktion trennt Label und Wert nur
// per Leerzeichen — ohne Wörterbuch würde jede Kommaliste zum Label.
const SKILL_LABEL_WORDS = new Set([
  'betriebssysteme', 'technologien', 'tools', 'programmiersprachen', 'sprachen',
  'frameworks', 'methoden', 'ki', 'ai', 'machine learning', 'datenbanken',
  'softskills', 'hardware', 'cloud', 'devops', 'kenntnisse', 'kompetenzen',
])

function skillLabelOf(line: string): { label: string; value: string } | null {
  // Jede Wortgrenze als Label/Wert-Grenze probieren — der erste Regex-Treffer
  // wäre zu kurz („Technologien &" statt „Technologien & Tools").
  const words = line.split(' ')
  for (let i = 1; i < words.length; i++) {
    const label = words.slice(0, i).join(' ')
    const value = words.slice(i).join(' ')
    if (!/^[A-ZÄÖÜ]/.test(value)) continue
    if (label.length > 30 || /[,(]/.test(label)) return null
    const parts = label.toLowerCase().split(/\s*&\s*/).map((p) => p.trim())
    if (parts.every((p) => SKILL_LABEL_WORDS.has(p))) return { label, value }
  }
  return null
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

// Komma-Split, der Kommas in Klammern ignoriert — „Linux (Ubuntu, Pop!_OS), SteamOS"
// sind zwei Kenntnisse, nicht vier.
function splitSkillsParenAware(line: string): string[] {
  const out: string[] = []
  let depth = 0
  let current = ''
  for (const ch of line) {
    if (ch === '(') depth++
    if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === ',' && depth === 0) {
      if (current.trim()) out.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) out.push(current.trim())
  return out
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
// Struktur — Kopfbereich (Datums-Artefakte, Name, Berufstitel), Überschriften-
// zeilen (auch mit Zusätzen wie „Kenntnisse & Fähigkeiten"), hart umgebrochene
// Absätze, Einträge als Titelzeile plus „Firma | Von – Bis", Bullets als •/-/*,
// Skills als „Label␣␣Wert"-Zeilen. Heuristik, kein Silberstreifen: Was nicht
// erkannt wird, fließt nicht in das strukturierte Dokument — die Route fängt
// das über resumeDataHasSubstance und rendert dann den Rohtext.
function parsePlainTextResume(text: string): ResumeData {
  const data = emptyResumeData()
  let section: 'profil' | 'erfahrung' | 'ausbildung' | 'skills' | 'sonstiges' | null = null
  let experience: ResumeData['experience'][number] | null = null
  let education: ResumeData['education'][number] | null = null
  // Titel- bzw. Abschluss-Kandidat, der auf Inhalt bzw. „Firma | Zeitraum" wartet
  let pendingExperienceTitle = ''
  let pendingEducationDegree = ''
  // Hart umgebrochener Satz in der Berufserfahrung, der auf seinen Punkt wartet
  let openParagraph = ''

  const isHeadingish = (line: string): boolean =>
    line.length <= 60 && !/[.!?]$/.test(line) && !/\)$/.test(line) && !isDateLine(line)

  // Umbruch-Absatz abschließen und der zuletzt erstellten Station zuordnen
  const closeParagraph = () => {
    if (!openParagraph) return
    const target = experience ?? data.experience[data.experience.length - 1]
    if (target) target.description.push(openParagraph)
    openParagraph = ''
  }

  const flushPendingExperience = (): ResumeData['experience'][number] | null => {
    closeParagraph()
    if (pendingExperienceTitle) {
      experience = { title: pendingExperienceTitle, company: '', startDate: '', description: [] }
      data.experience.push(experience)
      // Erststation als Berufstitel, wenn der Kopfbereich keinen hergab
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

    // Abschnittsüberschrift — beendet Eintrag und Sektion. Ein Zeilenanfang,
    // der auf den AKTUELLEN Abschnitt passt („Ausbildung zum Fachinformatiker"
    // während wir schon in der Ausbildung sind), ist Inhalt, keine Überschrift.
    const sectionAlias = sectionAliasOf(line)
    if (sectionAlias && SECTION_ALIASES[sectionAlias] !== section) {
      flushPendingExperience()
      flushPendingEducation()
      experience = null
      education = null
      section = SECTION_ALIASES[sectionAlias] ?? 'sonstiges'
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

    // Kopfbereich vor der ersten Sektion: Datums-Artefakte überspringen, dann
    // Name (kurz, ohne Ziffern/Satzeichen) und Berufstitel (länger, ohne Punkt)
    if (!section) {
      if (!data.name && !/[\d@]|\d/.test(line) && !/[.,;:!?]$/.test(line) && line.split(/\s+/).length <= 6) {
        data.name = line
        continue
      }
      if (!data.title && line.length > 10 && line.length <= 80 && !/[.!?]$/.test(line) && !isDateLine(line)) {
        data.title = line
        continue
      }
      continue
    }

    // Bullets: • · ▪ ◦ * -
    const bullet = line.match(/^[•·▪◦‣]\s+(.*)$/) ?? line.match(/^[-*]\s+(.*)$/)
    if (bullet) {
      const content = bullet[1].trim()
      if (section === 'erfahrung') {
        closeParagraph()
        flushPendingExperience()
        experience?.description.push(content)
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
      // Label-Zeilen (Doppel-Leerzeichen oder konventionelles Labelwort) werden
      // ein Eintrag mit Doppelpunkt; kurze Fortsetzungszeilen („ARM64)") hängen
      // an den letzten Eintrag.
      const doubleSpaceMatch = line.match(/^(.{2,30}?)\s{2,}(\S.*)$/)
      const label = doubleSpaceMatch
        ? { label: doubleSpaceMatch[1], value: doubleSpaceMatch[2] }
        : skillLabelOf(line)
      if (label) {
        data.skills.push(`${label.label}: ${label.value}`)
      } else if (line.length <= 12 && !line.includes(',') && data.skills.length > 0) {
        data.skills[data.skills.length - 1] += ` ${line}`
      } else {
        data.skills.push(...splitSkillsParenAware(line))
      }
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
      } else if (isDateLine(line) && pendingExperienceTitle && !openParagraph) {
        // nackter Zeitraum unter dem Titel — Firma fehlt
        const range = line.split(/–|—|\s-\s|\bbis\b/i)
        experience = { title: pendingExperienceTitle, company: '', startDate: range[0]?.trim() ?? '', endDate: range[1]?.trim() ?? '', description: [] }
        data.experience.push(experience)
        pendingExperienceTitle = ''
      } else if (openParagraph) {
        // Umbruch-Fortsetzung: Trennstrich zusammenführen (deutsche Wortbildung
        // kleinschreibt den Nachlauf: „Workflow-" + „Optimierung" → „Workflowoptimierung")
        openParagraph = openParagraph.endsWith('-')
          ? openParagraph.slice(0, -1) + line.charAt(0).toLowerCase() + line.slice(1)
          : `${openParagraph} ${line}`
        if (/[.!?]\)?$/.test(line)) {
          closeParagraph()
        }
      } else if (isHeadingish(line)) {
        // Unter-Überschrift → neue Station; wartender Vorgänger wird gesichert
        flushPendingExperience()
        pendingExperienceTitle = line
      } else if (pendingExperienceTitle) {
        // erster Inhalt unter der wartenden Überschrift → Station anlegen
        flushPendingExperience()
        openParagraph = line
        if (/[.!?]\)?$/.test(line)) closeParagraph()
      } else {
        // Inhalt ohne Überschrift — als Absatz führen, ggf. an letzte Station
        openParagraph = line
        if (/[.!?]\)?$/.test(line)) closeParagraph()
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
      } else if (/:\s/.test(line)) {
        // Detailzeile („Fachrichtung: …") gehört zur letzten Ausbildung — notfalls
        // wartet sie als erster Eintrag, statt eine eigene Station zu werden
        const current = flushPendingEducation()
        if (current) current.degree = `${current.degree} · ${line}`
        else pendingEducationDegree = pendingEducationDegree ? `${pendingEducationDegree} · ${line}` : line
      } else if (isHeadingish(line) || pendingEducationDegree) {
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
