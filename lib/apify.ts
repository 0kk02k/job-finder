// Apify integration for LinkedIn/XING/StepStone scraping
// Requires APIFY_API_KEY in env or user settings

export interface ApifyJob {
  title: string
  company: string
  location: string
  description: string
  url: string
  platform: string
  salary?: string
}

// Generic Apify actor call — runs synchronously and returns dataset items
async function callApifyActor(
  actorId: string,
  input: Record<string, unknown>,
  token: string,
  timeoutSec = 60
): Promise<any[]> {
  const response = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/run-sync-get-items?token=${token}&timeout=${timeoutSec}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }
  )

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Apify ${response.status}: ${text}`)
  }

  return response.json()
}

// Search LinkedIn jobs via Apify
export async function searchLinkedInJobs(
  query: string,
  location: string | undefined,
  token: string
): Promise<ApifyJob[]> {
  try {
    const results = await callApifyActor(
      'apify~linkedin-job-search',
      {
        searchKeyword: query,
        location: location || 'Germany',
        maxResults: 25,
      },
      token
    )

    return results.map((item: any): ApifyJob => ({
      title: item.title || '',
      company: item.companyName || item.company || '',
      location: item.location || '',
      description: (item.description || '').substring(0, 2000),
      url: item.url || item.link || '',
      platform: 'linkedin',
    }))
  } catch (error) {
    console.error('Apify LinkedIn job search error:', error)
    return []
  }
}

// Sync LinkedIn profile via Apify
export async function syncLinkedInProfileApify(
  profileUrl: string,
  token: string
): Promise<any | null> {
  try {
    const results = await callApifyActor(
      'apify~linkedin-profile-scraper',
      { profiles: [profileUrl] },
      token
    )

    if (results.length === 0) return null
    const p = results[0]

    return {
      id: p.id || profileUrl,
      name: p.fullName || p.name || '',
      headline: p.headline || '',
      location: p.address || p.location || '',
      about: p.about || '',
      experience: p.experience || [],
      education: p.education || [],
      skills: p.skills || [],
    }
  } catch (error) {
    console.error('Apify LinkedIn profile sync error:', error)
    return null
  }
}

// Check if Apify is available (key present)
export function hasApify(token?: string | null): boolean {
  return !!(token || process.env.APIFY_API_KEY)
}

export function getApifyToken(userKey?: string | null): string | null {
  return userKey || process.env.APIFY_API_KEY || null
}
