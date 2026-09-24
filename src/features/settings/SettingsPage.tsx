import { useEffect, useRef, useState } from 'react'
import { useFetcher, useLoaderData } from 'react-router'
import type { SettingsLoaderData } from './SettingsPage.loader'
import type { UserSettings } from '../../domain/models/user-profile'

export default function SettingsPage() {
  const { settings: loadedSettings } = useLoaderData() as SettingsLoaderData
  const fetcher = useFetcher<UserSettings>()
  const [settings, setSettings] = useState<UserSettings>(loadedSettings)
  const [savedSnapshot, setSavedSnapshot] = useState<UserSettings>(loadedSettings)
  // A successful action triggers this route's loader to revalidate, so the
  // fetcher's state machine is submitting -> loading -> idle, not just
  // submitting -> idle. Tracking only "was submitting" misses the "loading"
  // (revalidation) phase and never reaches the idle check.
  const wasInFlight = useRef(false)

  useEffect(() => {
    if (wasInFlight.current && fetcher.state === 'idle' && fetcher.data) {
      setSavedSnapshot(fetcher.data)
    }
    wasInFlight.current = fetcher.state !== 'idle'
  }, [fetcher.state, fetcher.data])

  function update<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  function handleSave() {
    fetcher.submit({ ...settings }, { method: 'post', encType: 'application/json' })
  }

  // UserSettings is a flat, fixed-shape object — compare fields directly
  // rather than via JSON.stringify. `settings` is built by spreading the
  // loader's settings (whatever field order the repository mapper produced),
  // while `savedSnapshot` comes from the action's Zod-parsed response
  // (always in the schema's own field order) — the same values can have a
  // different key insertion order, which JSON.stringify treats as unequal.
  const isSaved =
    settings.soundEnabled === savedSnapshot.soundEnabled &&
    settings.showKeyboard === savedSnapshot.showKeyboard &&
    settings.showEnglishKeys === savedSnapshot.showEnglishKeys &&
    settings.keyboardOpacity === savedSnapshot.keyboardOpacity &&
    settings.romanizationEnabled === savedSnapshot.romanizationEnabled &&
    settings.meaningLanguage === savedSnapshot.meaningLanguage &&
    settings.theme === savedSnapshot.theme

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-medium text-slate-900">Settings</h1>

      <div className="mt-6 space-y-4">
        <label className="flex items-center justify-between">
          <span>Sound</span>
          <input
            type="checkbox"
            checked={settings.soundEnabled}
            onChange={(e) => update('soundEnabled', e.target.checked)}
          />
        </label>

        <label className="flex items-center justify-between">
          <span>Show keyboard</span>
          <input
            type="checkbox"
            checked={settings.showKeyboard}
            onChange={(e) => update('showKeyboard', e.target.checked)}
          />
        </label>

        <label className="flex items-center justify-between">
          <span>Show English key labels</span>
          <input
            type="checkbox"
            checked={settings.showEnglishKeys}
            onChange={(e) => update('showEnglishKeys', e.target.checked)}
          />
        </label>

        <label className="flex items-center justify-between">
          <span>Keyboard opacity</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={settings.keyboardOpacity}
            onChange={(e) => update('keyboardOpacity', Number(e.target.value))}
          />
        </label>

        <label className="flex items-center justify-between">
          <span>Romanization</span>
          <input
            type="checkbox"
            checked={settings.romanizationEnabled}
            onChange={(e) => update('romanizationEnabled', e.target.checked)}
          />
        </label>

        <label className="flex items-center justify-between">
          <span>Meaning language</span>
          <select
            value={settings.meaningLanguage}
            onChange={(e) => update('meaningLanguage', e.target.value as UserSettings['meaningLanguage'])}
          >
            <option value="th">Thai</option>
            <option value="en">English</option>
            <option value="both">Both</option>
          </select>
        </label>

        <label className="flex items-center justify-between">
          <span>Theme</span>
          <select
            value={settings.theme}
            onChange={(e) => update('theme', e.target.value as UserSettings['theme'])}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={fetcher.state === 'submitting'}
          className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          Save
        </button>
        {isSaved && fetcher.data && <span className="text-sm text-emerald-600">Saved</span>}
      </div>
    </main>
  )
}
