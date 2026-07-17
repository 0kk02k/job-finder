// Platform Integration: LinkedIn, XING, StepStone, Indeed, Glassdoor
// OAuth, Profile Sync, AI-Enhanced Profile Management

import { chromium } from 'playwright'

export interface LinkedInProfile {
  id: string
  name: string
  headline: string
  location: string
  about: string
  experience: Array<{
    company: string
    title: string
    startDate: string
    endDate?: string
    description: string
  }>
  education: Array<{
    school: string
    degree: string
    field: string
    startDate: string
    endDate?: string
  }>
  skills: string[]
  recommendations?: string[]
}

export interface XINGProfile {
  id: string
  name: string
  headline: string
  location: string
  about: string
  experience: Array<{
    company: string
    title: string
    startDate: string
    endDate?: string
    description: string
  }>
  education: Array<{
    school: string
    degree: string
    field: string
    startDate: string
    endDate?: string
  }>
  skills: string[]
}

export interface StepStoneProfile {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  location: string
  experiences: Array<{
    company: string
    title: string
    startDate: string
    endDate?: string
    description: string
  }>
  education: Array<{
    institution: string
    degree: string
    graduationYear: string
  }>
  skills: string[]
  documents: Array<{
    name: string
    url: string
    type: 'resume' | 'cover_letter' | 'certificate'
  }>
}

export interface PlatformCredentials {
  platform: 'linkedin' | 'xing' | 'stepstone' | 'indeed' | 'glassdoor'
  email: string
  password: string // Encrypted in real app
  twoFactorCode?: string
}

// Sync LinkedIn profile via Playwright (LinkedIn API requires OAuth partnership)
export async function syncLinkedInProfile(credentials: PlatformCredentials): Promise<LinkedInProfile | null> {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    // Navigate to LinkedIn login
    await page.goto('https://www.linkedin.com/login')

    // Login
    await page.fill('input[name="session_key"]', credentials.email)
    await page.fill('input[name="session_password"]', credentials.password)
    await page.click('button[type="submit"]')

    // Wait for navigation
    await page.waitForURL('https://www.linkedin.com/feed/', { timeout: 15000 })

    // Navigate to profile
    await page.goto('https://www.linkedin.com/in/me/')
    await page.waitForTimeout(3000)

    // Extract profile data
    const profile: LinkedInProfile = {
      id: '',
      name: '',
      headline: '',
      location: '',
      about: '',
      experience: [],
      education: [],
      skills: [],
      recommendations: [],
    }

    // Extract basic info
    profile.name = await page.$eval('.text-heading-xlarge', el => el.textContent?.trim() || '')
    profile.headline = await page.$eval('.text-body-medium', el => el.textContent?.trim() || '')

    // Extract location
    try {
      profile.location = await page.$eval('.text-body-small.inline[data-anonymize="person-location"]', el => el.textContent?.trim() || '')
    } catch {}

    // Extract about section
    try {
      await page.click('button[aria-label="Expanders section"]')
      await page.waitForTimeout(1000)
      profile.about = await page.$eval('#about ~ div .display-full', el => el.textContent?.trim() || '')
    } catch {}

    // Extract experience
    try {
      await page.click('button[aria-label="Expanders section"]:has-text("Experience")')
      await page.waitForTimeout(1000)

      const experienceItems = await page.$$('.pvs-list__item--line-separated')

      for (const item of experienceItems.slice(0, 10)) {
        try {
          const title = await item.$eval('.t-bold span', el => el.textContent?.trim() || '')
          const company = await item.$eval('.t-14 t-black', el => el.textContent?.trim() || '')
          const dateRange = await item.$eval('.t-black--light', el => el.textContent?.trim() || '')
          const description = await item.$eval('.inline-show-more-text', el => el.textContent?.trim() || '')

          profile.experience.push({
            company,
            title,
            startDate: dateRange.split('–')[0]?.trim() || '',
            endDate: dateRange.split('–')[1]?.trim() || undefined,
            description,
          })
        } catch {}
      }
    } catch {}

    // Extract skills
    try {
      await page.click('button[aria-label="Expanders section"]:has-text("Skills")')
      await page.waitForTimeout(1000)

      const skillTags = await page.$$('[data-anonymize="skill"]')
      profile.skills = await Promise.all(
        skillTags.map(async el => {
          const text = await el.textContent()
          return text?.trim() || ''
        })
      )
    } catch {}

    await browser.close()
    return profile
  } catch (error) {
    console.error('LinkedIn sync error:', error)
    await browser.close()
    return null
  }
}

// Sync StepStone profile via Playwright
export async function syncStepStoneProfile(credentials: PlatformCredentials): Promise<StepStoneProfile | null> {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    // Navigate to StepStone login
    await page.goto('https://www.stepstone.de/user/login')

    // Login
    await page.fill('input[name="email"]', credentials.email)
    await page.fill('input[name="password"]', credentials.password)
    await page.click('button[type="submit"]')

    // Wait for navigation
    await page.waitForURL('https://www.stepstone.de/', { timeout: 15000 })

    // Navigate to profile
    await page.goto('https://www.stepstone.de/user/profile')
    await page.waitForTimeout(3000)

    const profile: StepStoneProfile = {
      id: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      location: '',
      experiences: [],
      education: [],
      skills: [],
      documents: [],
    }

    // Extract profile data (StepStone selectors vary)
    try {
      profile.firstName = await page.$eval('[data-testid="firstName"]', el => el.textContent?.trim() || '')
      profile.lastName = await page.$eval('[data-testid="lastName"]', el => el.textContent?.trim() || '')
      profile.location = await page.$eval('[data-testid="location"]', el => el.textContent?.trim() || '')
    } catch {}

    await browser.close()
    return profile
  } catch (error) {
    console.error('StepStone sync error:', error)
    await browser.close()
    return null
  }
}

// Sync XING profile via Playwright
export async function syncXINGProfile(credentials: PlatformCredentials): Promise<XINGProfile | null> {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    await page.goto('https://login.xing.com/')

    await page.fill('input[name="username"]', credentials.email)
    await page.fill('input[name="password"]', credentials.password)
    await page.click('button[type="submit"]')

    await page.waitForURL(/xing.com/, { timeout: 15000 })

    await page.goto('https://www.xing.com/profile')
    await page.waitForTimeout(3000)

    const profile: XINGProfile = {
      id: '',
      name: '',
      headline: '',
      location: '',
      about: '',
      experience: [],
      education: [],
      skills: [],
    }

    try {
      profile.name = await page.$eval('.user-name', el => el.textContent?.trim() || '')
      profile.headline = await page.$eval('.job-title', el => el.textContent?.trim() || '')
    } catch {}

    await browser.close()
    return profile
  } catch (error) {
    console.error('XING sync error:', error)
    await browser.close()
    return null
  }
}

// Indeed job search (no profile sync, just search capability)
export async function searchIndeedJobs(query: string, location: string): Promise<any[]> {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    await page.goto(`https://de.indeed.com/jobs?q=${encodeURIComponent(query)}&l=${encodeURIComponent(location)}`)
    await page.waitForTimeout(2000)

    const jobs = await page.$$eval('.job_seen_beacon', (items) =>
      items.map(item => ({
        title: item.querySelector('.jobTitle')?.textContent?.trim() || '',
        company: item.querySelector('[data-testid="company-name"]')?.textContent?.trim() || '',
        location: item.querySelector('[data-testid="job-location"]')?.textContent?.trim() || '',
        url: item.querySelector('a')?.href || '',
      }))
    )

    await browser.close()
    return jobs
  } catch (error) {
    console.error('Indeed search error:', error)
    await browser.close()
    return []
  }
}

// Glassdoor company info (no profile sync)
export async function getGlassdoorCompanyInfo(companyName: string): Promise<any> {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    await page.goto(`https://www.glassdoor.de/Reviews/${encodeURIComponent(companyName)}-Reviews.htm`)
    await page.waitForTimeout(2000)

    const rating = await page.$eval('.rating-num', el => el.textContent?.trim() || '').catch(() => 'N/A')
    const reviewCount = await page.$eval('.rating-count', el => el.textContent?.trim() || '').catch(() => 'N/A')

    await browser.close()
    return { rating, reviewCount, companyName }
  } catch (error) {
    console.error('Glassdoor error:', error)
    await browser.close()
    return { rating: 'N/A', reviewCount: 'N/A', companyName }
  }
}

// AI-enhanced profile optimization suggestions
export interface ProfileOptimization {
  strengths: string[]
  weaknesses: string[]
  suggestions: Array<{
    section: string
    current: string
    suggested: string
    reason: string
  }>
  missingSkills: string[]
  recommendedKeywords: string[]
  overallScore: number // 0-100
}

export async function optimizeProfile(
  profile: LinkedInProfile | StepStoneProfile,
  targetJobs: string[],
  aiProvider: string = 'ollama'
): Promise<ProfileOptimization> {
  const { createOpenAI } = await import('@ai-sdk/openai')
  const { generateText } = await import('ai')
  const ai = createOpenAI({
    baseURL: aiProvider === 'ollama' ? 'http://localhost:11434/v1' : undefined,
    apiKey: aiProvider === 'ollama' ? 'ollama' : undefined,
  })

  const profileText = JSON.stringify(profile, null, 2)
  const jobsText = targetJobs.join(', ')

  const prompt = `Du bist ein Karriere-Experte und LinkedIn/StepStone Profil-Optimierer. Analysiere dieses Profil für die Ziel-Jobs und gebe konkrete Verbesserungsvorschläge.

PROFIL:
${profileText}

ZIEL-JOBS:
${jobsText}

Gib zurück als JSON:
{
  "strengths": ["Stärke 1", "Stärke 2"],
  "weaknesses": ["Schwäche 1", "Schwäche 2"],
  "suggestions": [
    {
      "section": "z.B. Headline, About, Experience",
      "current": "Aktueller Inhalt",
      "suggested": "Verbesserter Inhalt",
      "reason": "Warum das besser ist"
    }
  ],
  "missingSkills": ["Fehlender Skill 1", "Fehlender Skill 2"],
  "recommendedKeywords": ["Keyword 1", "Keyword 2"],
  "overallScore": 75
}

Fokus auf:
1. Keywords für ATS-Optimierung
2. Quantifizierbare Ergebnisse
3. Relevante Skills hervorheben
4. Professionelle Sprache`

  try {
    const { text } = await generateText({
      model: ai('llama3.2'),
      messages: [{ role: 'user', content: prompt }],
    })

    const content = text || '{}'
    return JSON.parse(content) as ProfileOptimization
  } catch (error) {
    console.error('Profile optimization error:', error)
    return {
      strengths: [],
      weaknesses: [],
      suggestions: [],
      missingSkills: [],
      recommendedKeywords: [],
      overallScore: 50,
    }
  }
}

// Generate optimized profile sections
export async function generateOptimizedSection(
  section: 'headline' | 'about' | 'experience' | 'skills',
  currentContent: string,
  targetJobs: string[],
  aiProvider: string = 'ollama'
): Promise<string> {
  const { createOpenAI } = await import('@ai-sdk/openai')
  const { generateText } = await import('ai')
  const ai = createOpenAI({
    baseURL: aiProvider === 'ollama' ? 'http://localhost:11434/v1' : undefined,
    apiKey: aiProvider === 'ollama' ? 'ollama' : undefined,
  })

  const prompts = {
    headline: `Erstelle einen optimierten LinkedIn/StepStone Headline basierend auf:
Aktueller Headline: ${currentContent}
Ziel-Jobs: ${targetJobs.join(', ')}

Der Headline sollte:
- Keywords enthalten (für ATS)
- Professionell sein
- Einzigartig sein
- Max 220 Zeichen (LinkedIn Limit)

Gib nur den optimierten Headline zurück.`,

    about: `Erstelle einen optimierten "Über mich" / "About" Abschnitt basierend auf:
Aktueller Inhalt: ${currentContent}
Ziel-Jobs: ${targetJobs.join(', ')}

Der Abschnitt sollte:
- Persönlich aber professionell sein
- Keywords enthalten
- Unique Selling Points hervorheben
- 2-3 Absätze, max 2000 Zeichen

Gib nur den optimierten Text zurück.`,

    experience: `Optimiere diese Berufserfahrung:
Aktueller Inhalt: ${currentContent}
Ziel-Jobs: ${targetJobs.join(', ')}

Die Beschreibung sollte:
- Mit starken Verben starten
- Quantifizierbare Ergebnisse enthalten
- Keywords enthalten
- Concise sein (bullet points)

Gib nur den optimierten Text zurück.`,

    skills: `Erstelle eine optimierte Skills-Liste basierend auf:
Aktuelle Skills: ${currentContent}
Ziel-Jobs: ${targetJobs.join(', ')}

Gib 10-15 relevante Skills zurück, getrennt durch Kommas.
`

  }

  try {
    const { text } = await generateText({
      model: ai('llama3.2'),
      messages: [{ role: 'user', content: prompts[section] }],
    })

    return text || currentContent
  } catch {
    return currentContent
  }
}

// MCP (Model Context Protocol) support
export interface MCPCapability {
  name: string
  description: string
  inputSchema: any
}

export function getMCPCapabilities(): MCPCapability[] {
  return [
    {
      name: 'sync_linkedin_profile',
      description: 'Sync LinkedIn profile data',
      inputSchema: {
        type: 'object',
        properties: {
          credentials: {
            type: 'object',
            properties: {
              email: { type: 'string' },
              password: { type: 'string' },
            },
            required: ['email', 'password'],
          },
        },
        required: ['credentials'],
      },
    },
    {
      name: 'sync_stepstone_profile',
      description: 'Sync StepStone profile data',
      inputSchema: {
        type: 'object',
        properties: {
          credentials: {
            type: 'object',
            properties: {
              email: { type: 'string' },
              password: { type: 'string' },
            },
            required: ['email', 'password'],
          },
        },
        required: ['credentials'],
      },
    },
    {
      name: 'optimize_profile',
      description: 'Get AI-powered profile optimization suggestions',
      inputSchema: {
        type: 'object',
        properties: {
          profile: { type: 'object' },
          targetJobs: { type: 'array', items: { type: 'string' } },
          aiProvider: { type: 'string', enum: ['ollama', 'gemini', 'openrouter'] },
        },
        required: ['profile', 'targetJobs'],
      },
    },
    {
      name: 'generate_optimized_section',
      description: 'Generate AI-optimized profile section',
      inputSchema: {
        type: 'object',
        properties: {
          section: {
            type: 'string',
            enum: ['headline', 'about', 'experience', 'skills'],
          },
          currentContent: { type: 'string' },
          targetJobs: { type: 'array', items: { type: 'string' } },
          aiProvider: { type: 'string' },
        },
        required: ['section', 'currentContent', 'targetJobs'],
      },
    },
  ]
}

// MCP handler
export async function handleMCPRequest(capability: string, params: any) {
  switch (capability) {
    case 'sync_linkedin_profile':
      return await syncLinkedInProfile(params.credentials)
    case 'sync_stepstone_profile':
      return await syncStepStoneProfile(params.credentials)
    case 'optimize_profile':
      return await optimizeProfile(params.profile, params.targetJobs, params.aiProvider)
    case 'generate_optimized_section':
      return await generateOptimizedSection(
        params.section,
        params.currentContent,
        params.targetJobs,
        params.aiProvider
      )
    default:
      throw new Error(`Unknown capability: ${capability}`)
  }
}
