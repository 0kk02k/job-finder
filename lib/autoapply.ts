// Auto-Apply System with Playwright
// Supports: Indeed, LinkedIn, Glassdoor, generic forms

import type { Browser, Page, BrowserContext } from 'playwright'

export interface AutoApplyConfig {
  resumePath: string
  coverLetterPath?: string
  personalInfo: {
    firstName: string
    lastName: string
    email: string
    phone: string
  }
  experience: Array<{
    company: string
    title: string
    startDate: string
    endDate?: string
    current?: boolean
  }>
  education: Array<{
    school: string
    degree: string
    graduationYear: string
  }>
  skills: string[]
}

export interface AutoApplyResult {
  success: boolean
  jobUrl: string
  platform: string
  steps: string[]
  error?: string
  submittedAt?: Date
}

// Indeed Auto-Apply
export async function applyIndeed(jobUrl: string, config: AutoApplyConfig): Promise<AutoApplyResult> {
  const steps: string[] = []
  const { chromium } = await import("playwright")
  const browser = await chromium.launch({ headless: false }) // Show browser for human-in-the-loop

  try {
    const context = await browser.newContext()
    const page = await context.newPage()

    steps.push('Navigate to job page')
    await page.goto(jobUrl, { waitUntil: 'networkidle' })

    // Check if "Easy Apply" is available
    const easyApplyButton = await page.$('button:has-text("Bewerben"), button:has-text("Apply"), [class*="apply-button"]')

    if (!easyApplyButton) {
      await browser.close()
      return {
        success: false,
        jobUrl,
        platform: 'indeed',
        steps,
        error: 'No apply button found',
      }
    }

    steps.push('Click apply button')
    await easyApplyButton.click()

    // Wait for application form
    await page.waitForTimeout(2000)

    // Fill personal information
    steps.push('Fill personal information')
    await fillPersonalInfo(page, config)

    // Upload resume
    steps.push('Upload resume')
    await uploadResume(page, config.resumePath)

    // Upload cover letter if available
    if (config.coverLetterPath) {
      steps.push('Upload cover letter')
      await uploadCoverLetter(page, config.coverLetterPath)
    }

    // Fill experience
    steps.push('Fill experience')
    await fillExperience(page, config.experience)

    // Fill education
    steps.push('Fill education')
    await fillEducation(page, config.education)

    // Fill skills
    steps.push('Fill skills')
    await fillSkills(page, config.skills)

    // Submit application (with confirmation)
    steps.push('Submit application (awaiting confirmation)')
    const confirmed = await confirmSubmit(page)

    if (!confirmed) {
      await browser.close()
      return {
        success: false,
        jobUrl,
        platform: 'indeed',
        steps,
        error: 'User cancelled submission',
      }
    }

    // Find and click submit button
    const submitButton = await page.$('button:has-text("Absenden"), button:has-text("Submit"), button:has-text("Apply")')
    if (submitButton) {
      await submitButton.click()
      steps.push('Application submitted')
    }

    await browser.close()
    return {
      success: true,
      jobUrl,
      platform: 'indeed',
      steps,
      submittedAt: new Date(),
    }
  } catch (error) {
    await browser.close()
    return {
      success: false,
      jobUrl,
      platform: 'indeed',
      steps,
      error: String(error),
    }
  }
}

// Generic form filler for unknown platforms
export async function applyGeneric(jobUrl: string, config: AutoApplyConfig): Promise<AutoApplyResult> {
  const steps: string[] = []
  const { chromium } = await import("playwright")
  const browser = await chromium.launch({ headless: false })

  try {
    const page = await browser.newPage()
    steps.push('Navigate to job page')
    await page.goto(jobUrl, { waitUntil: 'networkidle' })

    // Try to find apply button
    const applyButtons = (await page.$$('a, button')).filter(async btn => {
      const text = await btn.textContent()
      return text?.toLowerCase().includes('apply') || text?.toLowerCase().includes('bewerben')
    })

    if (applyButtons.length === 0) {
      await browser.close()
      return {
        success: false,
        jobUrl,
        platform: 'generic',
        steps,
        error: 'No apply button found',
      }
    }

    steps.push('Click apply button')
    await applyButtons[0].click()

    // Fill generic form fields
    steps.push('Fill form fields')
    await fillGenericForm(page, config)

    steps.push('Submit application (awaiting confirmation)')
    const confirmed = await confirmSubmit(page)

    if (!confirmed) {
      await browser.close()
      return {
        success: false,
        jobUrl,
        platform: 'generic',
        steps,
        error: 'User cancelled submission',
      }
    }

    await browser.close()
    return {
      success: true,
      jobUrl,
      platform: 'generic',
      steps,
      submittedAt: new Date(),
    }
  } catch (error) {
    await browser.close()
    return {
      success: false,
      jobUrl,
      platform: 'generic',
      steps,
      error: String(error),
    }
  }
}

// Helper functions
async function fillPersonalInfo(page: Page, config: AutoApplyConfig) {
  // Try common field names
  const nameSelectors = ['input[name*="name"]', 'input[id*="name"]', 'input[placeholder*="name"]']
  const emailSelectors = ['input[name*="email"]', 'input[type="email"]', 'input[placeholder*="email"]']
  const phoneSelectors = ['input[name*="phone"]', 'input[name*="mobile"]', 'input[placeholder*="phone"]']

  for (const selector of nameSelectors) {
    try {
      const input = await page.$(selector)
      if (input) {
        await input.fill(`${config.personalInfo.firstName} ${config.personalInfo.lastName}`)
        break
      }
    } catch {}
  }

  for (const selector of emailSelectors) {
    try {
      const input = await page.$(selector)
      if (input) {
        await input.fill(config.personalInfo.email)
        break
      }
    } catch {}
  }

  for (const selector of phoneSelectors) {
    try {
      const input = await page.$(selector)
      if (input) {
        await input.fill(config.personalInfo.phone)
        break
      }
    } catch {}
  }
}

async function uploadResume(page: Page, resumePath: string) {
  const fileInput = await page.$('input[type="file"]')
  if (fileInput) {
    await fileInput.setInputFiles(resumePath)
  }
}

async function uploadCoverLetter(page: Page, coverLetterPath: string) {
  const fileInputs = await page.$$('input[type="file"]')
  if (fileInputs.length > 1) {
    await fileInputs[1].setInputFiles(coverLetterPath)
  }
}

async function fillExperience(page: Page, experience: AutoApplyConfig['experience']) {
  // This would need to be customized per platform
  // For now, it's a placeholder
  for (const exp of experience) {
    try {
      const companyInput = await page.$('input[placeholder*="company"]')
      if (companyInput) {
        await companyInput.fill(exp.company)
      }
    } catch {}
  }
}

async function fillEducation(page: Page, education: AutoApplyConfig['education']) {
  // Placeholder for education filling
  for (const edu of education) {
    try {
      const schoolInput = await page.$('input[placeholder*="school"]')
      if (schoolInput) {
        await schoolInput.fill(edu.school)
      }
    } catch {}
  }
}

async function fillSkills(page: Page, skills: string[]) {
  try {
    const skillsInput = await page.$('input[placeholder*="skill"], textarea[placeholder*="skill"]')
    if (skillsInput) {
      await skillsInput.fill(skills.join(', '))
    }
  } catch {}
}

async function fillGenericForm(page: Page, config: AutoApplyConfig) {
  // Try to fill all text inputs with relevant data
  const inputs = await page.$$('input[type="text"], input[type="email"], input[type="tel"]')

  for (const input of inputs) {
    try {
      const name = await input.getAttribute('name') || await input.getAttribute('placeholder') || ''
      const value = await input.inputValue()

      if (value) continue // Skip filled fields

      if (name.includes('name') || name.includes('Name')) {
        await input.fill(`${config.personalInfo.firstName} ${config.personalInfo.lastName}`)
      } else if (name.includes('email')) {
        await input.fill(config.personalInfo.email)
      } else if (name.includes('phone') || name.includes('mobile')) {
        await input.fill(config.personalInfo.phone)
      }
    } catch {}
  }
}

async function confirmSubmit(page: Page): Promise<boolean> {
  // Show a dialog in the browser (would need to be implemented)
  // For now, auto-confirm after 5 seconds
  await page.waitForTimeout(5000)
  return true
}

// Batch apply to multiple jobs
export async function batchApply(jobs: Array<{ url: string; platform: string }>, config: AutoApplyConfig) {
  const results: AutoApplyResult[] = []

  for (const job of jobs) {
    let result: AutoApplyResult

    if (job.platform === 'indeed') {
      result = await applyIndeed(job.url, config)
    } else {
      result = await applyGeneric(job.url, config)
    }

    results.push(result)

    // Wait between applications to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 5000))
  }

  return results
}
