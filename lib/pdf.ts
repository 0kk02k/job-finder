// PDF Export for Resumes and Cover Letters
// Uses Playwright to render HTML to PDF

import { chromium } from 'playwright'

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

// Generate HTML for modern resume template
function generateResumeHTML(data: ResumeData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    .header {
      border-bottom: 2px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .name {
      font-size: 32px;
      font-weight: 700;
      color: #1e3a8a;
      margin-bottom: 5px;
    }
    .title {
      font-size: 18px;
      color: #64748b;
      margin-bottom: 15px;
    }
    .contact {
      display: flex;
      gap: 20px;
      font-size: 14px;
      color: #64748b;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #1e3a8a;
      margin-bottom: 15px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .experience-item, .education-item {
      margin-bottom: 20px;
    }
    .item-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
    }
    .company, .school {
      font-weight: 600;
      color: #1a1a1a;
    }
    .date {
      color: #64748b;
      font-size: 14px;
    }
    .item-title {
      font-weight: 500;
      color: #475569;
      margin-bottom: 8px;
    }
    .description-list {
      list-style: none;
      padding-left: 0;
    }
    .description-list li {
      padding-left: 20px;
      position: relative;
      margin-bottom: 5px;
      font-size: 14px;
    }
    .description-list li:before {
      content: "•";
      position: absolute;
      left: 0;
      color: #2563eb;
    }
    .skills-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .skill-tag {
      background: #dbeafe;
      color: #1e40af;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
    }
    @media print {
      body { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="name">${data.name}</div>
    <div class="title">${data.title}</div>
    <div class="contact">
      <span>📧 ${data.email}</span>
      <span>📱 ${data.phone}</span>
      <span>📍 ${data.location}</span>
    </div>
  </div>

  ${data.summary ? `
  <div class="section">
    <div class="section-title">Profil</div>
    <p>${data.summary}</p>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">Berufserfahrung</div>
    ${data.experience.map(exp => `
      <div class="experience-item">
        <div class="item-header">
          <div class="company">${exp.company}</div>
          <div class="date">${exp.startDate} – ${exp.endDate || 'Heute'}</div>
        </div>
        <div class="item-title">${exp.title}</div>
        <ul class="description-list">
          ${exp.description.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>
    `).join('')}
  </div>

  <div class="section">
    <div class="section-title">Ausbildung</div>
    ${data.education.map(edu => `
      <div class="education-item">
        <div class="item-header">
          <div class="school">${edu.school}</div>
          <div class="date">${edu.graduationYear}</div>
        </div>
        <div class="item-title">${edu.degree}</div>
      </div>
    `).join('')}
  </div>

  <div class="section">
    <div class="section-title">Skills</div>
    <div class="skills-grid">
      ${data.skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
    </div>
  </div>
</body>
</html>
  `
}

// Generate HTML for cover letter
function generateCoverLetterHTML(data: CoverLetterData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Georgia', serif;
      line-height: 1.8;
      color: #1a1a1a;
      max-width: 700px;
      margin: 0 auto;
      padding: 60px 40px;
    }
    .header {
      margin-bottom: 40px;
    }
    .sender {
      margin-bottom: 5px;
      font-weight: 600;
    }
    .date {
      color: #64748b;
      margin-bottom: 20px;
    }
    .recipient {
      margin-bottom: 5px;
    }
    .salutation {
      margin-bottom: 20px;
    }
    .body {
      margin-bottom: 30px;
    }
    .body p {
      margin-bottom: 15px;
      text-align: justify;
    }
    .closing {
      margin-bottom: 10px;
    }
    .signature {
      margin-top: 40px;
    }
    @media print {
      body { padding: 40px 30px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="sender">${data.name}</div>
    <div class="date">${data.date}</div>
    <div class="recipient">
      ${data.recipientName ? `${data.recipientName}<br>` : ''}
      ${data.recipientTitle ? `${data.recipientTitle}<br>` : ''}
      ${data.recipientCompany}
    </div>
  </div>

  <div class="salutation">${data.salutation}</div>

  <div class="body">
    ${data.body.map(para => `<p>${para}</p>`).join('')}
  </div>

  <div class="closing">${data.closing}</div>
  <div class="signature">${data.name}</div>
</body>
</html>
  `
}

// Convert HTML to PDF using Playwright
export async function htmlToPDF(html: string, outputPath: string): Promise<void> {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  await page.setContent(html)
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20px',
      right: '20px',
      bottom: '20px',
      left: '20px',
    },
  })

  await browser.close()
}

// Generate resume PDF
export async function generateResumePDF(data: ResumeData, outputPath: string): Promise<void> {
  const html = generateResumeHTML(data)
  await htmlToPDF(html, outputPath)
}

// Generate cover letter PDF
export async function generateCoverLetterPDF(data: CoverLetterData, outputPath: string): Promise<void> {
  const html = generateCoverLetterHTML(data)
  await htmlToPDF(html, outputPath)
}

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
    // Headers
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
      // Contact info
      if (line.includes('@') && !data.email) {
        data.email = line.trim()
      } else if (line.includes('+') && !data.phone) {
        data.phone = line.trim()
      } else if (line.includes('📍') && !data.location) {
        data.location = line.replace('📍', '').trim()
      }
      // Experience details
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
