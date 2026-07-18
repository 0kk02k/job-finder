'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Settings {
  id: string
  aiProvider: string
  aiModel: string | null
  ollamaUrl: string | null
  geminiApiKey: string | null
  openaiApiKey: string | null
  targetTitles: string | null
  targetLocations: string | null
  minSalary: number | null
  remote: boolean
}

interface PlatformCredential {
  platform: string
  email: string
  syncStatus: string
  lastSyncAt: string | null
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [platformCreds, setPlatformCreds] = useState<Record<string, { email: string; password: string }>>({
    linkedin: { email: '', password: '' },
    xing: { email: '', password: '' },
    stepstone: { email: '', password: '' },
  })
  const [syncing, setSyncing] = useState<Record<string, boolean>>({})
  const [platformStatus, setPlatformStatus] = useState<Record<string, PlatformCredential>>({})

  useEffect(() => {
    fetchSettings()
    fetchPlatformStatus()
  }, [])

  async function fetchSettings() {
    try {
      const response = await fetch('/api/settings')
      const data = await response.json()
      setSettings(data)
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchPlatformStatus() {
    try {
      const response = await fetch('/api/platforms/sync')
      const data = await response.json()
      const statusMap: Record<string, PlatformCredential> = {}
      data.credentials?.forEach((c: PlatformCredential) => {
        statusMap[c.platform] = c
      })
      setPlatformStatus(statusMap)
      const newCreds = { ...platformCreds }
      Object.entries(statusMap).forEach(([platform, cred]) => {
        if (newCreds[platform]) {
          newCreds[platform].email = cred.email
        }
      })
      setPlatformCreds(newCreds)
    } catch (error) {
      console.error('Failed to fetch platform status:', error)
    }
  }

  async function saveSettings() {
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      alert('Einstellungen gespeichert!')
    } catch (error) {
      alert('Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  async function syncPlatform(platform: 'linkedin' | 'xing' | 'stepstone') {
    const creds = platformCreds[platform]
    if (!creds.email || !creds.password) {
      alert('Bitte Email und Passwort eingeben')
      return
    }

    setSyncing({ ...syncing, [platform]: true })
    try {
      const response = await fetch('/api/platforms/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          credentials: { email: creds.email, password: creds.password },
        }),
      })
      const data = await response.json()
      if (response.ok) {
        alert(`Profil erfolgreich von ${platform} synchronisiert!`)
        fetchPlatformStatus()
      } else {
        alert(`Fehler: ${data.error || 'Sync fehlgeschlagen'}`)
      }
    } catch (error) {
      alert('Fehler beim Synchronisieren')
    } finally {
      setSyncing({ ...syncing, [platform]: false })
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

      <main className="max-w-5xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-light text-[var(--color-foreground)] mb-12">
          Einstellungen
        </h1>

        <div className="space-y-12">
          {/* AI Settings */}
          <Section title="KI-Einstellungen" description="Wähle deinen KI-Provider und Konfiguration">
            <div className="space-y-6">
              <SelectField
                label="KI-Provider"
                value={settings.aiProvider}
                onChange={(value) => setSettings({ ...settings, aiProvider: value })}
                options={[
                  { value: 'ollama', label: 'Ollama (Lokal)' },
                  { value: 'gemini', label: 'Google Gemini' },
                  { value: 'openrouter', label: 'OpenRouter' },
                ]}
              />

              {settings.aiProvider === 'ollama' && (
                <InputField
                  label="Ollama URL"
                  type="text"
                  value={settings.ollamaUrl || ''}
                  onChange={(value) => setSettings({ ...settings, ollamaUrl: value })}
                  placeholder="http://localhost:11434"
                />
              )}

              {settings.aiProvider === 'gemini' && (
                <InputField
                  label="Gemini API Key"
                  type="password"
                  value={settings.geminiApiKey || ''}
                  onChange={(value) => setSettings({ ...settings, geminiApiKey: value })}
                  placeholder="AIza..."
                />
              )}

              <InputField
                label="KI-Modell (optional)"
                type="text"
                value={settings.aiModel || ''}
                onChange={(value) => setSettings({ ...settings, aiModel: value })}
                placeholder="llama3.2 oder gpt-4o-mini"
              />
            </div>
          </Section>

          {/* Job Preferences */}
          <Section title="Job-Präferenzen" description="Definiere deine Suchkriterien">
            <div className="space-y-6">
              <InputField
                label="Ziel-Job-Titles"
                type="text"
                value={settings.targetTitles || ''}
                onChange={(value) => setSettings({ ...settings, targetTitles: value })}
                placeholder="Software Engineer, Frontend Developer, Full Stack"
                help="Kommagetrennte Liste"
              />

              <InputField
                label="Ziel-Locations"
                type="text"
                value={settings.targetLocations || ''}
                onChange={(value) => setSettings({ ...settings, targetLocations: value })}
                placeholder="Berlin, Remote, München"
                help="Kommagetrennte Liste"
              />

              <ToggleField
                label="Nur Remote-Jobs"
                checked={settings.remote}
                onChange={(checked) => setSettings({ ...settings, remote: checked })}
              />
            </div>
          </Section>

          {/* Platform Credentials */}
          <Section title="Plattform-Credentials" description="Verbinde deine Konten für Profil-Sync und KI-Optimierung">
            <div className="space-y-8">
              {/* LinkedIn */}
              <PlatformCard
                name="LinkedIn"
                status={platformStatus.linkedin?.syncStatus}
                email={platformCreds.linkedin.email}
                password={platformCreds.linkedin.password}
                onEmailChange={(email) => setPlatformCreds({ ...platformCreds, linkedin: { ...platformCreds.linkedin, email } })}
                onPasswordChange={(password) => setPlatformCreds({ ...platformCreds, linkedin: { ...platformCreds.linkedin, password } })}
                onSync={() => syncPlatform('linkedin')}
                syncing={syncing.linkedin}
                color="blue"
              />

              {/* XING */}
              <PlatformCard
                name="XING"
                status={platformStatus.xing?.syncStatus}
                email={platformCreds.xing.email}
                password={platformCreds.xing.password}
                onEmailChange={(email) => setPlatformCreds({ ...platformCreds, xing: { ...platformCreds.xing, email } })}
                onPasswordChange={(password) => setPlatformCreds({ ...platformCreds, xing: { ...platformCreds.xing, password } })}
                onSync={() => syncPlatform('xing')}
                syncing={syncing.xing}
                color="teal"
              />

              {/* StepStone */}
              <PlatformCard
                name="StepStone"
                status={platformStatus.stepstone?.syncStatus}
                email={platformCreds.stepstone.email}
                password={platformCreds.stepstone.password}
                onEmailChange={(email) => setPlatformCreds({ ...platformCreds, stepstone: { ...platformCreds.stepstone, email } })}
                onPasswordChange={(password) => setPlatformCreds({ ...platformCreds, stepstone: { ...platformCreds.stepstone, password } })}
                onSync={() => syncPlatform('stepstone')}
                syncing={syncing.stepstone}
                color="red"
              />
            </div>
          </Section>

          {/* Save Button */}
          <div className="flex justify-end pt-4">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="inline-flex items-center justify-center px-8 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-[var(--color-surface)] rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Wird gespeichert...' : 'Einstellungen speichern'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

// Helper Components
function NavLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="text-[var(--color-primary-soft)] hover:text-[var(--color-foreground)] text-sm font-medium transition-colors"
    >
      {children}
    </Link>
  )
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl p-10 border border-[var(--color-border)] shadow-sm">
      <div className="mb-8">
        <h2 className="text-xl font-medium text-[var(--color-foreground)] mb-2">{title}</h2>
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

function SelectField({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-foreground)] mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] focus:border-[var(--color-accent)] focus:outline-none"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

function ToggleField({ label, checked, onChange }: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
      />
      <span className="text-sm text-[var(--color-foreground)]">{label}</span>
    </label>
  )
}

function PlatformCard({ name, status, email, password, onEmailChange, onPasswordChange, onSync, syncing, color }: {
  name: string
  status?: string
  email: string
  password: string
  onEmailChange: (email: string) => void
  onPasswordChange: (password: string) => void
  onSync: () => void
  syncing?: boolean
  color: 'blue' | 'teal' | 'red'
}) {
  const colorClasses = {
    blue: 'bg-[#5c7a57] hover:bg-[#4a6345]',
    teal: 'bg-[#5a7a6a] hover:bg-[#4a6355]',
    red: 'bg-[#8a5a5a] hover:bg-[#734a4a]',
  }

  return (
    <div className="border-b border-[var(--color-border-soft)] pb-8 last:border-0 last:pb-0">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-[var(--color-foreground)]">{name}</h3>
        {status === 'success' && (
          <span className="text-xs bg-[var(--color-success)] text-white px-3 py-1.5 rounded-full">
            Verbunden
          </span>
        )}
        {status === 'failed' && (
          <span className="text-xs bg-[var(--color-error)] text-white px-3 py-1.5 rounded-full">
            Fehler
          </span>
        )}
      </div>
      <div className="space-y-3">
        <input
          type="email"
          placeholder={`${name} Email`}
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] placeholder:text-[var(--color-primary-soft)] focus:border-[var(--color-accent)] focus:outline-none"
        />
        <input
          type="password"
          placeholder={`${name} Passwort`}
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] placeholder:text-[var(--color-primary-soft)] focus:border-[var(--color-accent)] focus:outline-none"
        />
        <button
          onClick={onSync}
          disabled={syncing}
          className={`w-full py-3 rounded-xl font-medium transition-colors text-white disabled:opacity-50 ${colorClasses[color]}`}
        >
          {syncing ? 'Synchronisiere...' : `${name} Profil synchronisieren`}
        </button>
      </div>
    </div>
  )
}
