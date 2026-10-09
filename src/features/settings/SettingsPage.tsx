import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useFetcher, useLoaderData } from 'react-router'
import { Keyboard, SlidersHorizontal, Volume2 } from 'lucide-react'
import type { SettingsLoaderData } from './SettingsPage.loader'
import type { UserSettings } from '../../domain/models/user-profile'
import type { SettingsActionData } from './SettingsPage.action'
import { Button } from '../../components/ui/Button'
import { Dropdown } from '../../components/ui/Dropdown'
import { PageNav } from '../../components/ui/PageNav'
import { PageSurface } from '../../components/ui/PageSurface'
import { useSnackbar } from '../../components/ui/SnackbarProvider'

// Pastel accents follow Home: only icons and switches carry a section's color.
const accents = {
  coral: {
    icon: 'bg-[#fde5e1] text-[#a85d4e]',
    switchOn: 'peer-checked:bg-[#c97a6b]',
  },
  mint: {
    icon: 'bg-[#ddf5e9] text-[#2f7a62]',
    switchOn: 'peer-checked:bg-[#5fae94]',
  },
  lavender: {
    icon: 'bg-[#f2edf9] text-[#7863a8]',
    switchOn: 'peer-checked:bg-[#9d8bc8]',
  },
}

type Accent = keyof typeof accents

function isSaveError(
  data: SettingsActionData | undefined,
): data is { error: string } {
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

  function update<K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K],
  ) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  return (
    <PageSurface contentClassName="max-w-5xl">
      <PageNav backTo="/" backLabel="Home" />
      <header>
        <p className="text-sm font-semibold text-[#a85d4e]">MAKE IT YOURS</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#253247]">
          Settings
        </h1>
        <p className="mt-1 text-sm leading-6 text-[#667085]">
          Choose a calm setup that helps you focus on your next character.
        </p>
      </header>
      <div className="mt-5 divide-y divide-[#f0e6dc] rounded-4xl border border-[#eadfd4] bg-[#fffdf9] px-5 shadow-[0_20px_55px_-35px_rgba(87,65,45,0.45)] sm:px-7">
        <SettingsSection
          icon={<Volume2 aria-hidden="true" size={18} />}
          accent="coral"
          title="Practice feel"
          description="Keep feedback comfortable while you learn."
        >
          <Switch
            label="Sound"
            accent="coral"
            checked={settings.soundEnabled}
            onChange={(value) => update('soundEnabled', value)}
          />
          <Switch
            label="Romanization"
            accent="coral"
            checked={settings.romanizationEnabled}
            onChange={(value) => update('romanizationEnabled', value)}
          />
          <DropdownRow>
            <Dropdown
              label="Meaning language"
              value={settings.meaningLanguage}
              onChange={(value) => update('meaningLanguage', value)}
              options={[
                { value: 'th', label: 'Thai' },
                { value: 'en', label: 'English' },
                { value: 'both', label: 'Both' },
              ]}
            />
          </DropdownRow>
        </SettingsSection>
        <SettingsSection
          icon={<Keyboard aria-hidden="true" size={18} />}
          accent="mint"
          title="Keyboard guide"
          description="Show just the hints you need."
        >
          <Switch
            label="Show keyboard"
            accent="mint"
            checked={settings.showKeyboard}
            onChange={(value) => update('showKeyboard', value)}
          />
          <Switch
            label="Show English key labels"
            accent="mint"
            checked={settings.showEnglishKeys}
            onChange={(value) => update('showEnglishKeys', value)}
          />
        </SettingsSection>
        <SettingsSection
          icon={<SlidersHorizontal aria-hidden="true" size={18} />}
          accent="lavender"
          title="Appearance"
          description="Light theme is styled for gentle, focused practice."
        >
          <DropdownRow>
            <Dropdown
              label="Theme"
              value={settings.theme}
              onChange={(value) => update('theme', value)}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </DropdownRow>
        </SettingsSection>
      </div>
      <div className="mt-6 flex justify-end">
        <Button
          onClick={() =>
            fetcher.submit(
              { ...settings },
              { method: 'post', encType: 'application/json' },
            )
          }
          disabled={fetcher.state !== 'idle'}
        >
          Save
        </Button>
      </div>
    </PageSurface>
  )
}

function SettingsSection({
  children,
  description,
  icon,
  accent,
  title,
}: {
  children: ReactNode
  description: string
  icon: ReactNode
  accent: Accent
  title: string
}) {
  return (
    <section className="py-6">
      <div className="flex items-center gap-3">
        <span className={`rounded-2xl p-2 ${accents[accent].icon}`}>
          {icon}
        </span>
        <div>
          <h2 className="font-bold text-[#253247]">{title}</h2>
          <p className="text-sm text-[#667085]">{description}</p>
        </div>
      </div>
      <div className="mt-5 space-y-4 sm:pl-12">{children}</div>
    </section>
  )
}

// Puts the shared Dropdown's label and trigger on one row from `sm` up.
function DropdownRow({ children }: { children: ReactNode }) {
  return (
    <div className="sm:[&>div]:grid-cols-[1fr_12rem] sm:[&>div]:items-center">
      {children}
    </div>
  )
}

function Switch({
  label,
  accent,
  checked,
  onChange,
}: {
  label: string
  accent: Accent
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold text-[#39465b]">
      <span>{label}</span>
      <span className="relative inline-flex shrink-0">
        <input
          aria-label={label}
          role="switch"
          className="peer sr-only"
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span
          aria-hidden="true"
          className={`h-6 w-11 rounded-full bg-[#e4ddd4] transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#bc6c5d] ${accents[accent].switchOn}`}
        />
        <span
          aria-hidden="true"
          className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5"
        />
      </span>
    </label>
  )
}
