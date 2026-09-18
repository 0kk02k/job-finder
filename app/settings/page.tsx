'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useToast } from '../components/Toast'
// Pure Kern-Modul (ohne AI-SDK) — Client-sicher, wie lib/anecdotes auf der
// Resume-Seite
import { parseStoredProfile } from '@/lib/preference-profile'

interface Settings {
  id: string
  aiProvider: string
  aiModel: string | null
  docTemplate: string | null
  ollamaUrl: string | null
  targetTitles: string | null
  targetLocations: string | null
  minSalary: number | null
  remote: boolean
  // JSON: PreferenceProfile aus dem Präferenz-Gespräch — wird nie per PUT
  // geschickt (nur die Synthese schreibt es), das Formular kann es nicht clobbern
  preferenceProfile: string | null
  // Keys kommen nie im Klartext zurück — nur Maskiert-Hinweise („••••4f2a“)
  nebiusKeyHint?: string | null
  geminiKeyHint?: string | null
  openaiKeyHint?: string | null
  openrouterKeyHint?: string | null
  apifyKeyHint?: string | null
  joobleKeyHint?: string | null
  adzunaAppIdHint?: string | null
  adzunaAppKeyHint?: string | null
}

// Neu getippte Keys — leer heißt: gespeicherten Key behalten
interface NewKeys {
  nebius: string
  gemini: string
  openai: string
  openrouter: string
  apify: string
  jooble: string
  adzunaAppId: string
  adzunaAppKey: string
}

interface ProfileOptimization {
  overallScore: number
  strengths: string[]
  weaknesses: string[]
  suggestions: { section: string; current: string; suggested: string; reason: string }[]
  missingSkills: string[]
}

const EMPTY_KEYS: NewKeys = { nebius: '', gemini: '', openai: '', openrouter: '', apify: '', jooble: '', adzunaAppId: '', adzunaAppKey: '' }

export default function SettingsPage() {
  const toast = useToast()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newKeys, setNewKeys] = useState<NewKeys>(EMPTY_KEYS)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Präferenzen-Profil: Löschen verdient Reibung (zweistufig), wie das Interview
  const [confirmDeleteProfile, setConfirmDeleteProfile] = useState(false)
  const [deletingProfile, setDeletingProfile] = useState(false)

  // Profile state
  const [profilePlatform, setProfilePlatform] = useState('linkedin')
  const [profileName, setProfileName] = useState('')
  const [profileHeadline, setProfileHeadline] = useState('')
  const [profileAbout, setProfileAbout] = useState('')
  const [profileLocation, setProfileLocation] = useState('')
  const [profileSkills, setProfileSkills] = useState('')
  const [profileError, setProfileError] = useState(false)
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
      setBaseline((prev) => prev ?? data)
      setNewKeys(EMPTY_KEYS)
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

  async function deletePreferenceProfile() {
    setDeletingProfile(true)
    setConfirmDeleteProfile(false)
    try {
      const response = await fetch('/api/preferences?scope=profile', { method: 'DELETE' })
      if (!response.ok) {
        toast.error('Löschen fehlgeschlagen — dein Profil bleibt erhalten.')
        return
      }
      setSettings((prev) => (prev ? { ...prev, preferenceProfile: null } : prev))
      toast.success('Präferenzen-Profil gelöscht.')
    } catch {
      toast.error('Netzwerkfehler — dein Profil bleibt erhalten.')
    } finally {
      setDeletingProfile(false)
    }
  }

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
        toast.error(data.error || 'Abgleich fehlgeschlagen')
      }
    } catch {
      toast.error('Abgleich fehlgeschlagen — bitte später erneut versuchen')
    } finally {
      setSyncing(false)
    }
  }

  async function fetchProfile() {
    try {
      const response = await fetch(`/api/platforms/profile?platform=${profilePlatform}`)
      if (!response.ok) {
        setProfileError(true)
        return
      }
      setProfileError(false)
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
      // Kein stiller Leerstand: Felder bleiben leer, die Sektion meldet den Fehler
      setProfileError(true)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilePlatform])

  // Snapshot der zuletzt gespeicherten Einstellungen — Basis für Dirty-Guard
  // und „Verbindung testen“ (der prüft bewusst nur die gespeicherte Welt);
  // gesetzt wird er in fetchSettings, nicht per Effect
  const [baseline, setBaseline] = useState<Settings | null>(null)

  function hasUnsavedChanges(): boolean {
    return dirty
  }

  // Ein Dirty-Zustand für alles: Guard, Verbindungstest UND die Fläche teilen
  // sich dieselbe Rechnung — was der Nutzer sieht, ist was der Browser schützt
  const dirty = useMemo(() => {
    if (!settings || !baseline) return false
    return (
      settings.aiProvider !== baseline.aiProvider ||
      (settings.aiModel ?? '') !== (baseline.aiModel ?? '') ||
      (settings.ollamaUrl ?? '') !== (baseline.ollamaUrl ?? '') ||
      (settings.targetTitles ?? '') !== (baseline.targetTitles ?? '') ||
      (settings.targetLocations ?? '') !== (baseline.targetLocations ?? '') ||
      (settings.minSalary ?? null) !== (baseline.minSalary ?? null) ||
      (settings.docTemplate ?? '') !== (baseline.docTemplate ?? '') ||
      settings.remote !== baseline.remote ||
      JSON.stringify(newKeys) !== JSON.stringify(EMPTY_KEYS) ||
      [profileName, profileHeadline, profileAbout, profileLocation, profileSkills].some((v) => v !== '')
    )
  }, [settings, baseline, newKeys, profileName, profileHeadline, profileAbout, profileLocation, profileSkills])

  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  async function saveSettings() {
    if (!settings) return
    setSaving(true)
    try {
      // Keys gehen nur mit, wenn neu getippt — leer/gespeichert bleibt unangetastet
      const payload: Record<string, unknown> = {
        aiProvider: settings.aiProvider,
        aiModel: settings.aiModel,
        ollamaUrl: settings.ollamaUrl,
        targetTitles: settings.targetTitles,
        targetLocations: settings.targetLocations,
        minSalary: settings.minSalary,
        remote: settings.remote,
        docTemplate: settings.docTemplate,
      }
      if (newKeys.nebius.trim()) payload.nebiusApiKey = newKeys.nebius.trim()
      if (newKeys.gemini.trim()) payload.geminiApiKey = newKeys.gemini.trim()
      if (newKeys.openai.trim()) payload.openaiApiKey = newKeys.openai.trim()
      if (newKeys.openrouter.trim()) payload.openrouterApiKey = newKeys.openrouter.trim()
      if (newKeys.apify.trim()) payload.apifyApiKey = newKeys.apify.trim()
      if (newKeys.jooble.trim()) payload.joobleApiKey = newKeys.jooble.trim()
      if (newKeys.adzunaAppId.trim()) payload.adzunaAppId = newKeys.adzunaAppId.trim()
      if (newKeys.adzunaAppKey.trim()) payload.adzunaAppKey = newKeys.adzunaAppKey.trim()

      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => undefined)
      if (!response.ok) {
        toast.error(data?.error || 'Speichern fehlgeschlagen — versuch es erneut.')
        return
      }
      setBaseline(data)
      await fetchSettings()
      setTestResult(null)
      toast.success('Einstellungen gespeichert')
    } catch {
      toast.error('Speichern fehlgeschlagen — prüfe deine Verbindung.')
    } finally {
      setSaving(false)
    }
  }

  async function testConnection() {
    if (hasUnsavedChanges()) {
      setTestResult({ ok: false, message: 'Ungespeicherte Änderungen — erst speichern, dann testen.' })
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const response = await fetch('/api/settings/test', { method: 'POST' })
      const data = await response.json().catch(() => undefined)
      if (response.ok && data?.ok) {
        setTestResult({ ok: true, message: `Verbindung steht — die KI antwortet (Modell: ${data.model})` })
      } else {
        setTestResult({ ok: false, message: data?.error || 'Der Verbindungstest ist fehlgeschlagen.' })
      }
    } catch {
      setTestResult({ ok: false, message: 'Netzwerkfehler — der Test konnte nicht ausgeführt werden.' })
    } finally {
      setTesting(false)
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
        toast.error('Speichern fehlgeschlagen — versuch es erneut.')
      }
    } catch {
      toast.error('Speichern fehlgeschlagen — prüfe deine Verbindung.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function optimizeProfile() {
    // Kein stiller Tech-Fallback: ohne Wunschberufe fragen wir nach statt
    // ein Pflege-Profil auf „Software Engineer“-Schlüsselwörter zu optimieren
    const targetJobs = settings?.targetTitles?.split(',').map(s => s.trim()).filter(Boolean) ?? []
    if (targetJobs.length === 0) {
      toast.error('Trage zuerst Wunschberufe ein (Abschnitt „Job-Präferenzen“).')
      return
    }
    setOptimizing(true)
    setOptimization(null)
    try {
      const response = await fetch('/api/platforms/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: profilePlatform,
          targetJobs,
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
      toast.error('Fehler bei der Optimierung — prüfe deine Verbindung.')
    } finally {
      setOptimizing(false)
    }
  }

  if (loading || !settings) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-primary-soft" role="status">Lade Einstellungen …</p>
      </div>
    )
  }

  // Ein Key-Feld pro Provider statt einer Fünf-Felder-Wand
  // KI-Schlüssel-Erklärung gilt für alle Anbieter gleich — einmal definieren
  const KEY_HELP = 'Ein API-Key ist der Zugangsschlüssel für die KI — du bekommst ihn einmalig bei deinem Anbieter und trägst ihn hier ein. Damit laufen Suche, Bewertung und Anschreiben. Er wird verschlüsselt gespeichert und nie wieder angezeigt.'

  const keyFieldFor: Record<string, { key: keyof NewKeys; label: string; hint?: string | null; help: string } | null> = {
    nebius: { key: 'nebius', label: 'KI-Schlüssel (Nebius)', hint: settings.nebiusKeyHint, help: KEY_HELP },
    gemini: { key: 'gemini', label: 'KI-Schlüssel (Google Gemini)', hint: settings.geminiKeyHint, help: KEY_HELP },
    openai: { key: 'openai', label: 'KI-Schlüssel (OpenAI)', hint: settings.openaiKeyHint, help: KEY_HELP },
    openrouter: { key: 'openrouter', label: 'KI-Schlüssel (OpenRouter)', hint: settings.openrouterKeyHint, help: KEY_HELP },
    ollama: null,
  }
  const activeKeyField = keyFieldFor[settings.aiProvider] ?? null

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-5xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-light text-foreground mb-12">Einstellungen</h1>

        <div className="space-y-12">
          {/* KI-Einstellungen */}
          <Section title="KI-Einstellungen" description="Wer die KI stellt und wie sie sich bei ihm ausweist — für Suche, Bewertung und Anschreiben">
            <div className="space-y-6">
              <div>
                <label htmlFor="settings-provider" className="block text-sm font-medium text-foreground mb-2">KI-Anbieter</label>
                <select
                  id="settings-provider"
                  value={settings.aiProvider || 'nebius'}
                  onChange={(e) => setSettings({ ...settings, aiProvider: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground"
                >
                  <option value="nebius">Nebius (Standard — ein Schlüssel genügt)</option>
                  <option value="ollama">Ollama (KI läuft auf deinem Rechner)</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI (die KI hinter ChatGPT)</option>
                  <option value="openrouter">OpenRouter (bündelt viele KIs)</option>
                </select>
                <p className="mt-2 text-xs text-primary-soft">
                  Die App braucht eine KI, um Jobs zu bewerten und Anschreiben zu schreiben.
                  Bei wem sie dafür anklopft, wählst du hier.
                </p>
              </div>

              <InputField
                label="Konkretes KI-Modell (optional — normalerweise frei lassen)"
                type="text"
                value={settings.aiModel || ''}
                onChange={(v) => setSettings({ ...settings, aiModel: v })}
                placeholder="moonshotai/Kimi-K3"
                help="Jeder Anbieter führt mehrere KIs mit kryptischen Namen. Die App weiß, welche sie nehmen soll — ändere das hier nur, wenn die Bewertungen fehlschlagen und du beim Anbieter eine neue Modell-ID findest."
              />

              {settings.aiProvider === 'ollama' && (
                <InputField
                  label="Adresse der lokalen KI (Ollama)"
                  type="text"
                  value={settings.ollamaUrl || ''}
                  onChange={(v) => setSettings({ ...settings, ollamaUrl: v })}
                  placeholder="http://localhost:11434"
                  help="Ollama ist ein kostenloses Programm, das die KI auf deinem eigenen Rechner laufen lässt — privat, ohne Schlüssel, aber langsamer. Diese Adresse stimmt meist unverändert."
                />
              )}

              {activeKeyField && (
                <InputField
                  label={activeKeyField.label}
                  type="password"
                  value={newKeys[activeKeyField.key]}
                  onChange={(v) => setNewKeys({ ...newKeys, [activeKeyField.key]: v })}
                  placeholder={
                    activeKeyField.hint
                      ? `Bereits hinterlegt: ${activeKeyField.hint} — zum Behalten leer lassen`
                      : 'Noch kein Schlüssel hinterlegt'
                  }
                  help={activeKeyField.help}
                />
              )}

              <InputField
                label="Schlüssel für Apify (optional)"
                type="password"
                value={newKeys.apify}
                onChange={(v) => setNewKeys({ ...newKeys, apify: v })}
                placeholder={settings.apifyKeyHint ? `Bereits hinterlegt: ${settings.apifyKeyHint} — zum Behalten leer lassen` : 'Noch kein Schlüssel hinterlegt'}
                help="Apify ist ein Dienst, der LinkedIn und XING nach Stellen durchsucht und dein Profil abgleicht (versuchsweise). Den Schlüssel bekommst du kostenlos auf apify.com."
              />

              {/* Speichern passiert am einen Save-Punkt unten (sticky) — hier
                  bleibt der Verbindungstest, der bewusst die gespeicherte Welt prüft */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={testConnection}
                  disabled={testing || saving}
                  className="px-6 py-3 bg-border-soft hover:bg-border text-foreground rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {testing ? 'Teste Verbindung …' : 'Verbindung testen'}
                </button>
              </div>

              {testResult && (
                <div
                  role="status"
                  className={`p-4 rounded-xl border text-sm ${
                    testResult.ok
                      ? 'bg-success/10 border-success/20 text-success'
                      : 'bg-error/10 border-error/20 text-error'
                  }`}
                >
                  {testResult.message}
                </div>
              )}
            </div>
          </Section>

          {/* Profil-Optimierung */}
          <Section title="Profil-Optimierung" description="Dein öffentliches Profil pflegen — und mit KI auf deine Wunschberufe zuschneiden lassen.">
            <div className="space-y-6">
              {profileError && (
                <div
                  role="status"
                  className="p-3 bg-warning/10 rounded-xl border border-warning/20 flex flex-wrap items-center justify-between gap-3"
                >
                  <p className="text-sm text-primary">Profil konnte nicht geladen werden.</p>
                  <button
                    onClick={() => void fetchProfile()}
                    className="text-sm font-medium text-primary hover:text-selection transition-colors"
                  >
                    Erneut versuchen
                  </button>
                </div>
              )}
              <div>
                <label htmlFor="profile-platform" className="block text-sm font-medium text-foreground mb-2">Plattform</label>
                <select
                  id="profile-platform"
                  value={profilePlatform}
                  onChange={(e) => setProfilePlatform(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground"
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
                label="Headline (dein Satz unter dem Namen)"
                type="text"
                value={profileHeadline}
                onChange={setProfileHeadline}
                placeholder="z. B. Pflegefachkraft | Onkologie und Patientenkoordination"
              />

              <InputField
                label="Ort"
                type="text"
                value={profileLocation}
                onChange={setProfileLocation}
                placeholder="z. B. Berlin, Deutschland"
              />

              <div>
                <label htmlFor="profile-about" className="block text-sm font-medium text-foreground mb-2">Über mich</label>
                <textarea
                  id="profile-about"
                  value={profileAbout}
                  onChange={(e) => setProfileAbout(e.target.value)}
                  rows={4}
                  placeholder="Kurze Beschreibung deiner Erfahrung und Schwerpunkte …"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm resize-none"
                />
              </div>

              <InputField
                label="Stärken und Fähigkeiten (kommagetrennt)"
                type="text"
                value={profileSkills}
                onChange={setProfileSkills}
                placeholder="z. B. Projektplanung, Wundmanagement, Buchhaltung, Python"
              />

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={saveProfile}
                  disabled={savingProfile || !profileName}
                  className="px-6 py-3 bg-border-soft hover:bg-border text-foreground rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {savingProfile ? 'Speichert …' : 'Profil speichern'}
                </button>
                <button
                  onClick={optimizeProfile}
                  disabled={optimizing || !profileName}
                  className="px-6 py-3 bg-accent hover:bg-accent-strong text-on-accent rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {optimizing ? 'Optimiert …' : 'Mit KI verbessern'}
                </button>
              </div>

              {/* Optimization Results */}
              {optimization && (
                <div className="mt-6 space-y-4 p-6 bg-background rounded-xl border border-border-soft">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-light text-primary tabular-nums">{optimization.overallScore}</span>
                    <span className="text-sm text-primary-soft">/ 100 Punkte</span>
                  </div>

                  {optimization.strengths?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-success mb-2">Stärken</h3>
                      <ul className="list-disc pl-5 space-y-1">
                        {optimization.strengths.map((s: string, i: number) => (
                          <li key={i} className="text-sm text-foreground">{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {optimization.weaknesses?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-error mb-2">Schwächen</h3>
                      <ul className="list-disc pl-5 space-y-1">
                        {optimization.weaknesses.map((w: string, i: number) => (
                          <li key={i} className="text-sm text-foreground">{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {optimization.suggestions?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-foreground mb-2">Verbesserungsvorschläge</h3>
                      <div className="space-y-3">
                        {optimization.suggestions.map((s, i) => (
                          <div key={i} className="p-4 bg-surface rounded-xl border border-border-soft">
                            <p className="text-xs font-medium text-primary mb-1">{s.section}</p>
                            {/* Der durchstrichene Ist-Stand trägt ein sichtbares
                                „alt"-Kennzeichen — Durchstreichung allein ist
                                farb- und schriftbildkodiert (WCAG 1.4.1) */}
                            <p className="text-xs text-primary-soft line-through mb-1">
                              {s.current}
                              <span className="sr-only"> (bisheriger Text)</span>
                            </p>
                            <p className="text-sm text-foreground">{s.suggested}</p>
                            <p className="text-xs text-primary-soft mt-1">{s.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {optimization.missingSkills?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-foreground mb-2">Fehlende Fähigkeiten</h3>
                      <div className="flex flex-wrap gap-2">
                        {optimization.missingSkills.map((s: string, i: number) => (
                          <span key={i} className="text-xs bg-border-soft text-foreground px-3 py-1.5 rounded-full">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Section>

          {/* Portal-Sync */}
          <Section title="Profil-Abgleich mit Jobportalen (versuchsweise)">
            <div className="space-y-6">
              <div className="p-4 bg-warning/10 rounded-xl border border-warning/20">
                <p className="text-sm text-warning">
                  Die App meldet sich dabei wie ein Browser bei deinem Portal an. Das kann
                  fehlschlagen, wenn das Portal Schutzabfragen oder eine Zwei-Faktor-Anmeldung
                  verlangt. Dein Passwort wird verschlüsselt gespeichert.
                </p>
              </div>

              {/* Sync Status */}
              {syncStatuses.length > 0 && (
                <div className="space-y-3">
                  {syncStatuses.map((cred) => (
                    <div key={cred.platform} className="flex items-center justify-between p-3 bg-background rounded-xl border border-border-soft">
                      <div>
                        <p className="text-sm font-medium text-foreground capitalize">{cred.platform}</p>
                        <p className="text-xs text-primary-soft">{cred.email}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-medium ${cred.syncStatus === 'success' ? 'text-success' : cred.syncStatus === 'failed' ? 'text-error' : 'text-primary-soft'}`}>
                          {cred.syncStatus === 'success' ? 'Verbunden' : cred.syncStatus === 'failed' ? 'Fehlgeschlagen' : 'Nie synchronisiert'}
                        </span>
                        {cred.lastSyncAt && (
                          <p className="text-xs text-primary-soft mt-0.5 tabular-nums">
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
                <label htmlFor="sync-platform" className="block text-sm font-medium text-foreground mb-2">Plattform</label>
                <select
                  id="sync-platform"
                  value={syncPlatform}
                  onChange={(e) => setSyncPlatform(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground"
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
                <label htmlFor="sync-password" className="block text-sm font-medium text-foreground mb-2">Passwort</label>
                <input
                  id="sync-password"
                  type="password"
                  value={syncPassword}
                  onChange={(e) => setSyncPassword(e.target.value)}
                  placeholder="Wird verschlüsselt gespeichert"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-primary-soft"
                />
              </div>

              <button
                onClick={handleSync}
                disabled={syncing || !syncEmail || !syncPassword}
                className="px-6 py-3 bg-accent hover:bg-accent-strong text-on-accent rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
              >
                {syncing ? 'Synchronisiert …' : 'Profil synchronisieren'}
              </button>
            </div>
          </Section>

          {/* Job-Präferenzen */}
          <Section title="Job-Präferenzen">
            {/* Profil aus dem Präferenz-Gespräch — gelesen wird es an der Grenze
                geparst (Müll → null), geschrieben nur von der Synthese */}
            {(() => {
              const prefProfile = parseStoredProfile(settings.preferenceProfile)
              return (
                <div
                  id="job-praeferenzen"
                  className={`rounded-xl p-6 border mb-8 ${prefProfile ? 'bg-accent-soft/20 border-accent/20' : 'bg-surface border-border'}`}
                >
                  {prefProfile ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <p className="text-sm font-medium text-foreground">Dein Präferenzen-Profil</p>
                        <div className="flex items-center gap-4">
                          <Link
                            href="/preferences"
                            className="text-sm text-primary hover:text-selection transition-colors"
                          >
                            Gespräch neu führen
                          </Link>
                          {/* Selten + ersatzlos — deshalb zweistufig, wie alle destruktiven Aktionen */}
                          <button
                            onClick={() => {
                              if (confirmDeleteProfile) {
                                void deletePreferenceProfile()
                              } else {
                                setConfirmDeleteProfile(true)
                                setTimeout(() => setConfirmDeleteProfile(false), 5000)
                              }
                            }}
                            disabled={deletingProfile}
                            className={`text-sm transition-colors disabled:opacity-50 ${
                              confirmDeleteProfile
                                ? 'font-medium text-error'
                                : 'text-primary-soft hover:text-error'
                            }`}
                          >
                            {deletingProfile
                              ? 'Wird gelöscht …'
                              : confirmDeleteProfile
                                ? 'Wirklich löschen'
                                : 'Profil löschen'}
                          </button>
                        </div>
                      </div>
                      {prefProfile.enjoys && (
                        <p className="text-sm text-foreground leading-relaxed mb-3">{prefProfile.enjoys}</p>
                      )}
                      {prefProfile.criteria.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {prefProfile.criteria.map((c, i) => (
                            // Notiz sichtbar unter dem Chip statt title-only
                            // (Hover ist Touch- und Tastatur-unsichtbar)
                            <div key={i} className="max-w-xs">
                              <span
                                className={`inline-block px-3 py-1.5 rounded-full text-xs font-medium border ${
                                  c.weight === 'hoch'
                                    ? 'border-accent/40 bg-accent-soft/30 text-foreground'
                                    : c.weight === 'niedrig'
                                      ? 'border-border bg-transparent text-primary-soft'
                                      : 'border-border bg-border-soft text-foreground'
                                }`}
                              >
                                {c.topic} · {c.weight}
                              </span>
                              {c.note && (
                                <p className="text-xs text-primary-soft mt-1">{c.note}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {prefProfile.avoids.length > 0 && (
                        <p className="text-sm text-primary-soft mb-2">Meidet: {prefProfile.avoids.join('; ')}</p>
                      )}
                      {prefProfile.growth && (
                        <p className="text-sm text-primary-soft">Entwicklung: {prefProfile.growth}</p>
                      )}
                      <p className="text-xs text-primary-soft mt-3">
                        Fließt in neue Bewertungen und Suchen ein — bestehende Job-Scores bleiben unverändert.
                      </p>
                    </>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-primary-soft">
                        Noch kein Profil — führe das Präferenz-Gespräch, damit Bewertung und Suche deine
                        Gewichtung kennen.
                      </p>
                      <Link
                        href="/preferences"
                        className="px-5 py-2.5 bg-accent hover:bg-accent-strong text-on-accent rounded-xl font-medium text-sm transition-colors flex-shrink-0"
                      >
                        Präferenz-Gespräch starten
                      </Link>
                    </div>
                  )}
                </div>
              )
            })()}
            <div className="space-y-6">
              <InputField
                label="Wunschberufe"
                type="text"
                value={settings.targetTitles || ''}
                onChange={(v) => setSettings({ ...settings, targetTitles: v })}
                placeholder="z. B. Pflegefachkraft, Tischlerin, Lehrer, Data Analyst"
                help="Kommagetrennt."
              />
              <InputField
                label="Wunschorte"
                type="text"
                value={settings.targetLocations || ''}
                onChange={(v) => setSettings({ ...settings, targetLocations: v })}
                placeholder="z. B. Berlin, Remote, München"
                help="Kommagetrennt."
              />
              <div>
                <label htmlFor="settings-minsalary" className="block text-sm font-medium text-foreground mb-2">Mindestgehalt (€/Jahr, optional)</label>
                <input
                  id="settings-minsalary"
                  type="number"
                  value={settings.minSalary ?? ''}
                  onChange={(e) => setSettings({ ...settings, minSalary: e.target.value ? Number(e.target.value) : null })}
                  placeholder="z. B. 50000"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-primary-soft"
                />
                <p className="mt-2 text-xs text-primary-soft">
                  Fließt in die KI-Bewertung ein: Stellen darunter werden etwas schlechter bewertet.
                </p>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.remote}
                  onChange={(e) => setSettings({ ...settings, remote: e.target.checked })}
                  className="w-5 h-5 rounded border-border accent-selection"
                />
                <span className="text-sm text-foreground">Nur Remote-Jobs</span>
              </label>
            </div>
          </Section>

          {/* Bewerbungsdokumente */}
          <Section title="Bewerbungsdokumente" description="Design für Lebenslauf und Anschreiben — als PDF und DOCX">
            <div>
              <label htmlFor="settings-doc-template" className="block text-sm font-medium text-foreground mb-2">Dokumenten-Design</label>
              <select
                id="settings-doc-template"
                value={settings.docTemplate || 'modern'}
                onChange={(e) => setSettings({ ...settings, docTemplate: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground"
              >
                <option value="modern">Modern — Sans-Schrift, blaue Akzente</option>
                <option value="klassisch">Klassisch — Serifenschrift, schwarz-weiß</option>
                <option value="kompakt">Kompakt — kleine Schrift, viel auf eine Seite</option>
              </select>
              <p className="mt-2 text-xs text-primary-soft">Gilt für alle Downloads von Lebenslauf und Anschreiben.</p>
            </div>
          </Section>

          {/* Job-Quellen */}
          <Section title="Job-Quellen" description="Zusätzliche Stellen-Sammlungen — ohne Angaben sucht die App bei der Arbeitsagentur, Remotive und Arbeitnow">
            <div className="space-y-6">
              <InputField
                label="Schlüssel für Jooble (optional)"
                type="password"
                value={newKeys.jooble}
                onChange={(v) => setNewKeys({ ...newKeys, jooble: v })}
                placeholder={settings.joobleKeyHint ? `Bereits hinterlegt: ${settings.joobleKeyHint} — zum Behalten leer lassen` : 'Noch kein Schlüssel hinterlegt'}
                help="Jooble sammelt Stellen aus hunderten deutschen Jobbörsen an einem Ort. Den Schlüssel bekommst du kostenlos auf jooble.org/api — dort heißt er „API key“, gemeint ist genau das."
              />
              <InputField
                label="Adzuna App-ID (optional)"
                type="text"
                value={newKeys.adzunaAppId}
                onChange={(v) => setNewKeys({ ...newKeys, adzunaAppId: v })}
                placeholder={settings.adzunaAppIdHint ? `Bereits hinterlegt: ${settings.adzunaAppIdHint} — zum Behalten leer lassen` : 'Noch keine App-ID hinterlegt'}
                help="Adzuna bringt deutsche Stellen mit Gehaltsangaben in die Suche. Du bekommst zwei Angaben, die zusammengehören: diese ID und den Schlüssel darunter. Die ID ist kein Geheimnis — aber erst beide zusammen schalten die Quelle frei."
              />
              <InputField
                label="Adzuna-Schlüssel (App-Key, optional)"
                type="password"
                value={newKeys.adzunaAppKey}
                onChange={(v) => setNewKeys({ ...newKeys, adzunaAppKey: v })}
                placeholder={settings.adzunaAppKeyHint ? `Bereits hinterlegt: ${settings.adzunaAppKeyHint} — zum Behalten leer lassen` : 'Noch kein Schlüssel hinterlegt'}
                help="Der zweite Teil des Adzuna-Zugangs — gemeinsam mit der ID oben. Kostenlos auf developer.adzuna.com."
              />
            </div>
          </Section>

          {/* Der eine Save-Punkt der Seite: erscheint, sobald es ungespeicherte
              Änderungen gibt, und klebt am unteren Rand — egal wie weit unten die
              bearbeitete Sektion liegt. Nach dem Speichern verschwindet er. */}
          {dirty && !saving && (
            <div className="sticky bottom-4 z-10 flex justify-end">
              <div className="flex items-center gap-3 bg-surface rounded-2xl border border-border shadow-sm px-4 py-3">
                <span className="text-xs text-warning">Ungespeicherte Änderungen</span>
                <button
                  onClick={saveSettings}
                  className="px-5 py-2 bg-accent hover:bg-accent-strong text-on-accent rounded-xl font-medium text-sm transition-colors"
                >
                  Speichern
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-2xl p-8 border border-border shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-medium text-foreground mb-1">{title}</h2>
        {description && <p className="text-sm text-primary-soft">{description}</p>}
      </div>
      {children}
    </div>
  )
}

// Label umschließt das Feld (implizite Zuordnung — kein fehlendes htmlFor)
function InputField({ label, type, value, onChange, placeholder, help }: {
  label: string
  type: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  help?: string
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-foreground mb-2">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-primary-soft"
      />
      {help && <span className="block mt-2 text-xs text-primary-soft">{help}</span>}
    </label>
  )
}
