'use client'

import { useEffect, useState } from 'react'
import { useToast } from '../components/Toast'

interface Settings {
  id: string
  aiProvider: string
  aiModel: string | null
  apifyApiKey: string | null
  ollamaUrl: string | null
  geminiApiKey: string | null
  openaiApiKey: string | null
  mistralApiKey: string | null
  openrouterApiKey: string | null
  targetTitles: string | null
  targetLocations: string | null
  minSalary: number | null
  remote: boolean
}

interface ProfileOptimization {
  overallScore: number
  strengths: string[]
  weaknesses: string[]
  suggestions: { section: string; current: string; suggested: string; reason: string }[]
  missingSkills: string[]
}

export default function SettingsPage() {
  const toast = useToast()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Profile state
  const [profilePlatform, setProfilePlatform] = useState('linkedin')
  const [profileName, setProfileName] = useState('')
  const [profileHeadline, setProfileHeadline] = useState('')
  const [profileAbout, setProfileAbout] = useState('')
  const [profileLocation, setProfileLocation] = useState('')
  const [profileSkills, setProfileSkills] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [optimization, setOptimization] = useState<ProfileOptimization | null>(null)

  // Sync state
  const [syncPlatform, setSyncPlatform] = useState('linkedin')
  const [syncEmail, setSyncEmail] = useState('')
  const [syncPassword, setSyncPassword] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncStatuses, setSyncStatuses] = useState<{ platform: string; email: string; syncStatus: string; lastSyncAt: string | null }[]>([])

  async function fetchSettings() {
    try {
      const response = await fetch('/api/settings')
      const data = await response.json()
      setSettings(data)
    } catch {
      console.error('Failed to fetch settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initialer Daten-Fetch; setState läuft erst nach dem await
    void fetchSettings()
    void fetchSyncStatus()
  }, [])

  async function fetchSyncStatus() {
    try {
      const response = await fetch('/api/platforms/sync')
      if (!response.ok) return
      const data = await response.json()
      if (Array.isArray(data.credentials)) setSyncStatuses(data.credentials)
    } catch {
      // Sync-Status kann nicht geladen werden
    }
  }

  async function handleSync() {
    if (!syncEmail || !syncPassword) return
    setSyncing(true)
    try {
      const response = await fetch('/api/platforms/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: syncPlatform,
          credentials: { email: syncEmail, password: syncPassword },
        }),
      })
      const data = await response.json()
      if (response.ok) {
        toast.success('Profil synchronisiert')
        setSyncPassword('')
        fetchSyncStatus()
      } else {
        toast.error(data.error || 'Sync fehlgeschlagen')
      }
    } catch {
      toast.error('Sync fehlgeschlagen — bitte später erneut versuchen')
    } finally {
      setSyncing(false)
    }
  }

  async function fetchProfile() {
    try {
      const response = await fetch(`/api/platforms/profile?platform=${profilePlatform}`)
      if (!response.ok) return
      const profiles = await response.json()
      const profile = Array.isArray(profiles) ? profiles[0] : null
      if (profile) {
        setProfileName(profile.name || '')
        setProfileHeadline(profile.headline || '')
        setProfileAbout(profile.about || '')
        setProfileLocation(profile.location || '')
        try {
          const skills = profile.skills ? JSON.parse(profile.skills) : []
          setProfileSkills(Array.isArray(skills) ? skills.join(', ') : '')
        } catch {
          setProfileSkills('')
        }
      } else {
        setProfileName('')
        setProfileHeadline('')
        setProfileAbout('')
        setProfileLocation('')
        setProfileSkills('')
      }
    } catch {
      // Profil kann nicht geladen werden — Felder bleiben leer
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilePlatform])

  async function saveSettings() {
    if (!settings) return
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiProvider: settings.aiProvider,
          aiModel: settings.aiModel,
          ollamaUrl: settings.ollamaUrl,
          geminiApiKey: settings.geminiApiKey,
          openaiApiKey: settings.openaiApiKey,
          mistralApiKey: settings.mistralApiKey,
          openrouterApiKey: settings.openrouterApiKey,
          apifyApiKey: settings.apifyApiKey,
          targetTitles: settings.targetTitles,
          targetLocations: settings.targetLocations,
          minSalary: settings.minSalary,
          remote: settings.remote,
        }),
      })
      toast.success('Einstellungen gespeichert')
    } catch {
      toast.error('Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  async function saveProfile() {
    setSavingProfile(true)
    try {
      const response = await fetch('/api/platforms/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: profilePlatform,
          name: profileName,
          headline: profileHeadline,
          about: profileAbout,
          location: profileLocation,
          skills: profileSkills.split(',').map(s => s.trim()).filter(Boolean),
        }),
      })

      if (response.ok) {
        toast.success('Profil gespeichert')
      } else {
        toast.error('Fehler beim Speichern')
      }
    } catch {
      toast.error('Fehler beim Speichern')
    } finally {
      setSavingProfile(false)
    }
  }

  async function optimizeProfile() {
    setOptimizing(true)
    setOptimization(null)
    try {
      const response = await fetch('/api/platforms/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: profilePlatform,
          targetJobs: settings?.targetTitles?.split(',').map(s => s.trim()) || ['Software Engineer'],
        }),
      })

      const data = await response.json()
      if (response.ok) {
        const opt = data.optimization
        setOptimization({
          overallScore: opt?.overallScore ?? 0,
          strengths: opt?.strengths ?? [],
          weaknesses: opt?.weaknesses ?? [],
          suggestions: opt?.suggestions ?? [],
          missingSkills: opt?.missingSkills ?? [],
        })
      } else {
        toast.error(data.error || 'Optimierung fehlgeschlagen')
      }
    } catch {
      toast.error('Fehler bei der Optimierung')
    } finally {
      setOptimizing(false)
    }
  }

  if (loading || !settings) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <p className="text-[var(--color-primary-soft)]">Lade Einstellungen...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-light text-[var(--color-foreground)] mb-12">Einstellungen</h1>

        <div className="space-y-12">
          {/* AI Settings */}
          <Section title="KI-Einstellungen" description="Provider und API-Keys für KI-Features">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-[var(--color-foreground)] mb-2">KI-Anbieter</label>
                <select
                  value={settings.aiProvider || 'mistral'}
                  onChange={(e) => setSettings({ ...settings, aiProvider: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] focus:border-[var(--color-accent)] focus:outline-none"
                >
                  <option value="mistral">Mistral</option>
                  <option value="ollama">Ollama (lokal)</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="openrouter">OpenRouter</option>
                </select>
                <p className="mt-2 text-xs text-[var(--color-primary-soft)]">Bestimmt, welcher Dienst für KI-Suche und Job-Bewertung genutzt wird.</p>
              </div>

              <InputField
                label="KI-Modell (optional)"
                type="text"
                value={settings.aiModel || ''}
                onChange={(v) => setSettings({ ...settings, aiModel: v })}
                placeholder="mistral-small-latest"
              />

              {settings.aiProvider === 'ollama' && (
                <InputField
                  label="Ollama-URL"
                  type="text"
                  value={settings.ollamaUrl || ''}
                  onChange={(v) => setSettings({ ...settings, ollamaUrl: v })}
                  placeholder="http://localhost:11434"
                  help="Ollama muss lokal laufen — kostenlos und ohne API-Key, aber langsamer."
                />
              )}

              <InputField
                label="Gemini API Key (optional)"
                type="password"
                value={settings.geminiApiKey || ''}
                onChange={(v) => setSettings({ ...settings, geminiApiKey: v })}
                placeholder="Nur nötig bei Anbieter Google Gemini"
              />

              <InputField
                label="OpenAI API Key (optional)"
                type="password"
                value={settings.openaiApiKey || ''}
                onChange={(v) => setSettings({ ...settings, openaiApiKey: v })}
                placeholder="Nur nötig bei Anbieter OpenAI"
              />

              <InputField
                label="Mistral API Key (optional)"
                type="password"
                value={settings.mistralApiKey || ''}
                onChange={(v) => setSettings({ ...settings, mistralApiKey: v })}
                placeholder="Nur nötig bei Anbieter Mistral"
              />

              <InputField
                label="OpenRouter API Key (optional)"
                type="password"
                value={settings.openrouterApiKey || ''}
                onChange={(v) => setSettings({ ...settings, openrouterApiKey: v })}
                placeholder="Nur nötig bei Anbieter OpenRouter"
              />

              <InputField
                label="Apify API Key (optional)"
                type="password"
                value={settings.apifyApiKey || ''}
                onChange={(v) => setSettings({ ...settings, apifyApiKey: v })}
                placeholder="Für LinkedIn/XING Job-Suche und Profil-Sync"
                help="Kostenlos auf apify.com — ermöglicht automatisierte LinkedIn-Suche"
              />
            </div>
          </Section>

          {/* Profile Optimization */}
          <Section title="Profil-Optimierung" description="Dein LinkedIn/XING/StepStone Profil für KI-Analyse">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-[var(--color-foreground)] mb-2">Plattform</label>
                <select
                  value={profilePlatform}
                  onChange={(e) => setProfilePlatform(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] focus:border-[var(--color-accent)] focus:outline-none"
                >
                  <option value="linkedin">LinkedIn</option>
                  <option value="xing">XING</option>
                  <option value="stepstone">StepStone</option>
                </select>
              </div>

              <InputField
                label="Name"
                type="text"
                value={profileName}
                onChange={setProfileName}
                placeholder="Max Mustermann"
              />

              <InputField
                label="Headline"
                type="text"
                value={profileHeadline}
                onChange={setProfileHeadline}
                placeholder="Senior Software Engineer | React, Node.js, TypeScript"
              />

              <InputField
                label="Location"
                type="text"
                value={profileLocation}
                onChange={setProfileLocation}
                placeholder="Berlin, Deutschland"
              />

              <div>
                <label className="block text-sm font-medium text-[var(--color-foreground)] mb-2">Über mich</label>
                <textarea
                  value={profileAbout}
                  onChange={(e) => setProfileAbout(e.target.value)}
                  rows={4}
                  placeholder="Kurze Beschreibung deiner Erfahrung und Schwerpunkte..."
                  className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] text-sm focus:border-[var(--color-accent)] focus:outline-none resize-none"
                />
              </div>

              <InputField
                label="Skills (kommagetrennt)"
                type="text"
                value={profileSkills}
                onChange={setProfileSkills}
                placeholder="React, TypeScript, Node.js, Python, AWS"
              />

              <div className="flex gap-3">
                <button
                  onClick={saveProfile}
                  disabled={savingProfile || !profileName}
                  className="px-6 py-3 bg-[var(--color-border-soft)] hover:bg-[var(--color-border)] text-[var(--color-foreground)] rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {savingProfile ? 'Speichert...' : 'Profil speichern'}
                </button>
                <button
                  onClick={optimizeProfile}
                  disabled={optimizing || !profileName}
                  className="px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-[var(--color-surface)] rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {optimizing ? 'Optimiert...' : '🤖 KI-Optimierung'}
                </button>
              </div>

              {/* Optimization Results */}
              {optimization && (
                <div className="mt-6 space-y-4 p-6 bg-[var(--background)] rounded-xl border border-[var(--color-border-soft)]">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-light text-[var(--color-primary)]">{optimization.overallScore}</span>
                    <span className="text-sm text-[var(--color-primary-soft)]">/ 100 Profil-Score</span>
                  </div>

                  {optimization.strengths?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-[var(--color-success)] mb-2">Stärken</h4>
                      <ul className="space-y-1">
                        {optimization.strengths.map((s: string, i: number) => (
                          <li key={i} className="text-sm text-[var(--color-foreground)]">✓ {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {optimization.weaknesses?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-[var(--color-error)] mb-2">Schwächen</h4>
                      <ul className="space-y-1">
                        {optimization.weaknesses.map((w: string, i: number) => (
                          <li key={i} className="text-sm text-[var(--color-foreground)]">• {w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {optimization.suggestions?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-[var(--color-foreground)] mb-2">Verbesserungsvorschläge</h4>
                      <div className="space-y-3">
                        {optimization.suggestions.map((s, i) => (
                          <div key={i} className="p-4 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border-soft)]">
                            <p className="text-xs font-medium text-[var(--color-primary)] mb-1">{s.section}</p>
                            <p className="text-xs text-[var(--color-primary-soft)] line-through mb-1">{s.current}</p>
                            <p className="text-sm text-[var(--color-foreground)]">{s.suggested}</p>
                            <p className="text-xs text-[var(--color-primary-soft)] mt-1">{s.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {optimization.missingSkills?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-[var(--color-foreground)] mb-2">Fehlende Skills</h4>
                      <div className="flex flex-wrap gap-2">
                        {optimization.missingSkills.map((s: string, i: number) => (
                          <span key={i} className="text-xs bg-[var(--color-border-soft)] text-[var(--color-foreground)] px-3 py-1.5 rounded-full">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Section>

          {/* Platform Sync */}
          <Section title="Platform-Sync" description="LinkedIn/XING/StepStone Profil automatisch importieren">
            <div className="space-y-6">
              <div className="p-4 bg-[var(--color-warning)]/10 rounded-xl border border-[var(--color-warning)]/20">
                <p className="text-sm text-[var(--color-warning)]">
                  ⚠️ Der Sync nutzt Playwright-Scraping und kann durch Anti-Bot-Maßnahmen oder 2FA fehlschlagen. Passwörter werden AES-256-GCM verschlüsselt gespeichert.
                </p>
              </div>

              {/* Sync Status */}
              {syncStatuses.length > 0 && (
                <div className="space-y-3">
                  {syncStatuses.map((cred) => (
                    <div key={cred.platform} className="flex items-center justify-between p-3 bg-[var(--background)] rounded-xl border border-[var(--color-border-soft)]">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-foreground)] capitalize">{cred.platform}</p>
                        <p className="text-xs text-[var(--color-primary-soft)]">{cred.email}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-medium ${cred.syncStatus === 'success' ? 'text-[var(--color-success)]' : cred.syncStatus === 'failed' ? 'text-[var(--color-error)]' : 'text-[var(--color-primary-soft)]'}`}>
                          {cred.syncStatus === 'success' ? '✓ Synced' : cred.syncStatus === 'failed' ? '✗ Fehlgeschlagen' : 'Nie'}
                        </span>
                        {cred.lastSyncAt && (
                          <p className="text-xs text-[var(--color-primary-soft)] mt-0.5">
                            {new Date(cred.lastSyncAt).toLocaleDateString('de-DE')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Credential Input */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-foreground)] mb-2">Plattform</label>
                <select
                  value={syncPlatform}
                  onChange={(e) => setSyncPlatform(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] focus:border-[var(--color-accent)] focus:outline-none"
                >
                  <option value="linkedin">LinkedIn</option>
                  <option value="xing">XING</option>
                  <option value="stepstone">StepStone</option>
                </select>
              </div>

              <InputField
                label="E-Mail"
                type="email"
                value={syncEmail}
                onChange={setSyncEmail}
                placeholder="deine.email@beispiel.de"
              />

              <div>
                <label className="block text-sm font-medium text-[var(--color-foreground)] mb-2">Passwort</label>
                <input
                  type="password"
                  value={syncPassword}
                  onChange={(e) => setSyncPassword(e.target.value)}
                  placeholder="Wird verschlüsselt gespeichert"
                  className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] placeholder:text-[var(--color-primary-soft)] focus:border-[var(--color-accent)] focus:outline-none"
                />
              </div>

              <button
                onClick={handleSync}
                disabled={syncing || !syncEmail || !syncPassword}
                className="px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-[var(--color-surface)] rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
              >
                {syncing ? 'Synchronisiert...' : 'Profil synchronisieren'}
              </button>
            </div>
          </Section>

          {/* Job Preferences */}
          <Section title="Job-Präferenzen" description="Deine Suchkriterien">
            <div className="space-y-6">
              <InputField
                label="Ziel-Job-Titles"
                type="text"
                value={settings.targetTitles || ''}
                onChange={(v) => setSettings({ ...settings, targetTitles: v })}
                placeholder="Software Engineer, Frontend Developer"
                help="Kommagetrennte Liste"
              />
              <InputField
                label="Ziel-Locations"
                type="text"
                value={settings.targetLocations || ''}
                onChange={(v) => setSettings({ ...settings, targetLocations: v })}
                placeholder="Berlin, Remote, München"
                help="Kommagetrennte Liste"
              />
              <div>
                <label className="block text-sm font-medium text-[var(--color-foreground)] mb-2">Mindestgehalt (€/Jahr, optional)</label>
                <input
                  type="number"
                  value={settings.minSalary ?? ''}
                  onChange={(e) => setSettings({ ...settings, minSalary: e.target.value ? Number(e.target.value) : null })}
                  placeholder="z.B. 50000"
                  className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] placeholder:text-[var(--color-primary-soft)] focus:border-[var(--color-accent)] focus:outline-none"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.remote}
                  onChange={(e) => setSettings({ ...settings, remote: e.target.checked })}
                  className="w-5 h-5 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
                />
                <span className="text-sm text-[var(--color-foreground)]">Nur Remote-Jobs</span>
              </label>
            </div>
          </Section>

          {/* Save */}
          <div className="flex justify-end">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="px-8 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-[var(--color-surface)] rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Wird gespeichert...' : 'Einstellungen speichern'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl p-8 border border-[var(--color-border)] shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-medium text-[var(--color-foreground)] mb-1">{title}</h2>
        <p className="text-sm text-[var(--color-primary-soft)]">{description}</p>
      </div>
      {children}
    </div>
  )
}

function InputField({ label, type, value, onChange, placeholder, help }: {
  label: string
  type: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  help?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-foreground)] mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] placeholder:text-[var(--color-primary-soft)] focus:border-[var(--color-accent)] focus:outline-none"
      />
      {help && <p className="mt-2 text-xs text-[var(--color-primary-soft)]">{help}</p>}
    </div>
  )
}
