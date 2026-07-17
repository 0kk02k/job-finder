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
  let currentItem: any = null

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
      } else if (currentSection === 'ausbildung' || currentSection === 'education') {
        currentItem = { degree: title, school: '', graduationYear: '' }
        data.education.push(currentItem)
      }
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const content = line.substring(2).trim()
      if (currentItem && currentSection === 'skills') {
        data.skills.push(content)
      } else if (currentItem) {
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
      if (currentItem && currentSection === 'erfahrung') {
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

// Generate cover letter from job description and resume
export function generateCoverLetterFromJob(
  resumeData: ResumeData,
  jobDescription: string,
  company: string
): CoverLetterData {
  const today = new Date().toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return {
    name: resumeData.name,
    recipientCompany: company,
    date: today,
    salutation: 'Sehr geehrte Damen und Herren,',
    body: [
      `mit großem Interesse bewerbe ich mich bei ${company} für die ausgeschriebene Stelle. Meine Erfahrung und Qualifikationen passen hervorragend zu den Anforderungen.`,
      `Als ${resumeData.title} verfüge ich über umfassende Erfahrung in ${resumeData.skills.slice(0, 3).join(', ')}. In meiner bisherigen Laufbahn konnte ich mir fundierte Kenntnisse in verschiedenen Projekten aneignen.`,
      `Besonders begeistert mich an ${company} die innovativen Ansätze und die Unternehmenskultur. Ich bin überzeugt, dass ich mit meinem Background einen wertvollen Beitrag zum Team leisten kann.`,
      `Gerne stelle ich mich Ihnen in einem persönlichen Gespräch vor und freue mich auf Ihre Rückmeldung.`,
    ],
    closing: 'Mit freundlichen Grüßen',
  }
}
