import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useFetcher, useLoaderData } from 'react-router'
import { Keyboard, SlidersHorizontal, Volume2 } from 'lucide-react'
import type { SettingsLoaderData } from './SettingsPage.loader'
import type { UserSettings } from '../../domain/models/user-profile'
import type { SettingsActionData } from './SettingsPage.action'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Dropdown } from '../../components/ui/Dropdown'
import { PageSurface } from '../../components/ui/PageSurface'
import { useSnackbar } from '../../components/ui/SnackbarProvider'

function isSaveError(data: SettingsActionData | undefined): data is { error: string } {
  return Boolean(data && 'error' in data)
}

export default function SettingsPage() {
  const { settings: loadedSettings } = useLoaderData() as SettingsLoaderData
  const fetcher = useFetcher<SettingsActionData>()
  const { showError, showSuccess } = useSnackbar()
  const [settings, setSettings] = useState<UserSettings>(loadedSettings)
  const wasInFlight = useRef(false)

  useEffect(() => {
    if (wasInFlight.current && fetcher.state === 'idle' && fetcher.data) {
      if (isSaveError(fetcher.data)) showError(fetcher.data.error)
      else {
        showSuccess('Settings saved')
      }
    }
    wasInFlight.current = fetcher.state !== 'idle'
  }, [fetcher.state, fetcher.data, showError, showSuccess])

  function update<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  return <PageSurface contentClassName="max-w-2xl">
    <header className="rounded-4xl border border-[#f0dfd1] bg-[#fffdf9] px-6 py-8 shadow-[0_20px_55px_-35px_rgba(87,65,45,0.45)]">
      <p className="text-sm font-semibold text-[#a85d4e]">MAKE IT YOURS</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">Settings</h1>
      <p className="mt-2 text-sm leading-6 text-[#667085]">Choose a calm setup that helps you focus on your next character.</p>
    </header>
    <div className="mt-6 space-y-4">
      <SettingsCard icon={<Volume2 aria-hidden="true" size={18} />} tone="peach" title="Practice feel" description="Keep feedback comfortable while you learn.">
        <Toggle label="Sound" checked={settings.soundEnabled} onChange={(value) => update('soundEnabled', value)} />
        <Toggle label="Romanization" checked={settings.romanizationEnabled} onChange={(value) => update('romanizationEnabled', value)} />
        <Dropdown label="Meaning language" value={settings.meaningLanguage} onChange={(value) => update('meaningLanguage', value)} options={[{ value: 'th', label: 'Thai' }, { value: 'en', label: 'English' }, { value: 'both', label: 'Both' }]} />
      </SettingsCard>
      <SettingsCard icon={<Keyboard aria-hidden="true" size={18} />} tone="sage" title="Keyboard guide" description="Show just the hints you need.">
        <Toggle label="Show keyboard" checked={settings.showKeyboard} onChange={(value) => update('showKeyboard', value)} />
        <Toggle label="Show English key labels" checked={settings.showEnglishKeys} onChange={(value) => update('showEnglishKeys', value)} />
      </SettingsCard>
      <SettingsCard icon={<SlidersHorizontal aria-hidden="true" size={18} />} tone="lilac" title="Appearance" description="Light theme is styled for gentle, focused practice.">
        <Dropdown label="Theme" value={settings.theme} onChange={(value) => update('theme', value)} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
      </SettingsCard>
    </div>
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <Button onClick={() => fetcher.submit({ ...settings }, { method: 'post', encType: 'application/json' })} disabled={fetcher.state !== 'idle'}>Save</Button>
      <Link to="/" className="rounded-full px-4 py-2 text-sm font-semibold text-[#667085] hover:bg-white/70 hover:text-[#8d4c43]">Back to Course List</Link>
    </div>
  </PageSurface>
}

function SettingsCard({ children, description, icon, title, tone }: { children: ReactNode; description: string; icon: ReactNode; title: string; tone: 'peach' | 'sage' | 'lilac' }) {
  return <Card tone={tone}><div className="flex items-center gap-3"><span className="rounded-2xl bg-white/80 p-2 text-[#7863a8]">{icon}</span><div><h2 className="font-bold">{title}</h2><p className="text-sm text-[#667085]">{description}</p></div></div><div className="mt-5 space-y-4">{children}</div></Card>
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center justify-between gap-4 text-sm font-semibold text-[#39465b]"><span>{label}</span><input aria-label={label} className="h-5 w-5 accent-[#a85d4e]" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>
}
