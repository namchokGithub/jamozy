import { useEffect, useId, useRef, useState } from 'react'
import { Link, useFetcher } from 'react-router'
import { Volume2 } from 'lucide-react'
import type { UserSettings } from '../../domain/models/user-profile'
import { Dropdown } from '../../components/ui/Dropdown'
import { useSnackbar } from '../../components/ui/SnackbarProvider'
import type { SettingsActionData } from './SettingsPage.action'
import { applyTheme } from './apply-theme'

interface QuickSettingsModalProps {
  settings: UserSettings
  onClose: () => void
}

function isSaveError(
  data: SettingsActionData | undefined,
): data is { error: string } {
  return Boolean(data && 'error' in data)
}

export function QuickSettingsModal({
  settings: loadedSettings,
  onClose,
}: QuickSettingsModalProps) {
  const fetcher = useFetcher<SettingsActionData>()
  const { showError } = useSnackbar()
  const [settings, setSettings] = useState(loadedSettings)
  const panelRef = useRef<HTMLElement>(null)
  const titleId = useId()

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) onClose()
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose])

  useEffect(() => {
    if (fetcher.state === 'idle' && isSaveError(fetcher.data)) {
      showError(fetcher.data.error)
    }
  }, [fetcher.data, fetcher.state, showError])

  function update<K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K],
  ) {
    const next = { ...settings, [key]: value }
    setSettings(next)
    if (key === 'theme') applyTheme(value as UserSettings['theme'])
    fetcher.submit(next, {
      action: '/settings',
      method: 'post',
      encType: 'application/json',
    })
  }

  const isSaving = fetcher.state !== 'idle'

  return (
    <section
      ref={panelRef}
      role="dialog"
      aria-labelledby={titleId}
      className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-[min(26.25rem,calc(100vw-2rem))] rounded-3xl border border-line bg-card p-6 shadow-popover"
    >
      <h2 id={titleId} className="text-xl font-bold tracking-tight text-ink">
        Quick settings
      </h2>
      <div className="mt-5 space-y-5">
        <section aria-label="Sound settings">
          <p className="flex items-center gap-2 text-sm font-bold text-ink">
            <span className="rounded-xl bg-coral-100 p-1.5 text-coral-600">
              <Volume2 aria-hidden="true" size={16} />
            </span>
            Sound
          </p>
          <div className="mt-3 flex items-center justify-between gap-4 rounded-2xl border border-coral-100 bg-coral-50/60 px-4 py-3">
            <span className="text-sm font-semibold text-ink-soft">Sound</span>
            <label className="relative inline-flex shrink-0">
              <input
                aria-label="Sound"
                role="switch"
                type="checkbox"
                checked={settings.soundEnabled}
                disabled={isSaving}
                onChange={(event) =>
                  update('soundEnabled', event.target.checked)
                }
                className="peer sr-only"
              />
              <span className="h-6 w-11 rounded-full bg-coral-200 transition-colors peer-checked:bg-coral-500 peer-disabled:cursor-not-allowed peer-disabled:opacity-50" />
              <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5 peer-disabled:opacity-50" />
            </label>
          </div>
          <div className="mt-3">
            <Dropdown
              label="Keyboard sound"
              value={settings.keyboardSoundPack}
              disabled={isSaving}
              onChange={(value) => update('keyboardSoundPack', value)}
              options={[
                { value: 'turquoise', label: 'Turquoise Tealio' },
                { value: 'mxblack', label: 'Cherry MX Blacks' },
                { value: 'mxblue', label: 'Cherry MX Blues' },
              ]}
            />
          </div>
        </section>

        <div className="border-t border-line-soft" />

        <section aria-label="Theme settings">
          <p className="text-sm font-bold text-ink">Theme</p>
          <div
            className="mt-3 grid grid-cols-3 rounded-2xl bg-lavender-100 p-1"
            role="group"
            aria-label="Theme"
          >
            {(['light', 'dark', 'system'] as const).map((theme) => (
              <button
                key={theme}
                type="button"
                disabled={isSaving}
                aria-pressed={settings.theme === theme}
                onClick={() => update('theme', theme)}
                className={`rounded-xl px-2 py-2 text-sm font-semibold capitalize transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                  settings.theme === theme
                    ? 'bg-card text-lavender-700 shadow-sm'
                    : 'text-lavender-600 hover:text-lavender-700'
                }`}
              >
                {theme}
              </button>
            ))}
          </div>
        </section>

        <Link
          to="/settings"
          className="flex w-full items-center justify-center rounded-full border border-line bg-surface/90 px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-line-hover hover:text-coral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-500"
        >
          Open all settings →
        </Link>
      </div>
    </section>
  )
}
