import { useEffect, useState } from 'react'
import type { UserSettings } from '../../domain/models/user-profile'

export type SoundSettings = Pick<UserSettings, 'soundEnabled' | 'keyboardSoundPack'>

const silentSettings: SoundSettings = {
  soundEnabled: false,
  keyboardSoundPack: 'turquoise',
}

export function useResolvedSoundSettings(
  settings: SoundSettings | Promise<SoundSettings>,
): SoundSettings {
  const [resolved, setResolved] = useState<{
    source: SoundSettings | Promise<SoundSettings>
    value: SoundSettings
  }>(() => ({
    source: settings,
    value: settings instanceof Promise ? silentSettings : settings,
  }))

  useEffect(() => {
    if (!(settings instanceof Promise)) return
    let mounted = true
    void settings
      .then((value) => {
        if (mounted) setResolved({ source: settings, value })
      })
      .catch(() => undefined)
    return () => {
      mounted = false
    }
  }, [settings])

  if (!(settings instanceof Promise)) return settings
  return resolved.source === settings ? resolved.value : silentSettings
}
