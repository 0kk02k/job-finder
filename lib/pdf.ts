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

// Parse resume markdown to structured data
export function parseResumeMarkdown(markdown: string): ResumeData {
  const lines = markdown.split('\n')
  const data: ResumeData = {
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
