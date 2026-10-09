import { useEffect, useMemo } from 'react'
import type { KeyboardSoundPack } from '../../domain/models/user-profile'
import { keyboardSoundPlayer } from '../../infrastructure/audio/keyboard-sound-player'
import { keyboardSoundAssets } from './keyboard-sound-assets'
import { pressSoundFor, releaseSoundFor } from './keyboard-sound-map'
import { isKoreanJamoKey } from '../../domain/korean/keymap'

export function useKeyboardSound(
  enabled: boolean,
  pack: KeyboardSoundPack,
  active = true,
) {
  const assets = useMemo(() => keyboardSoundAssets(pack), [pack])
  useEffect(() => {
    if (!enabled || !active) return
    void keyboardSoundPlayer.load(assets)
    const pressed = new Set<string>()
    const down = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        !isKoreanJamoKey(event.code)
      ) return
      pressed.add(event.code)
      void keyboardSoundPlayer.unlock()
      keyboardSoundPlayer.play(pressSoundFor(pack, event.code))
    }
    const up = (event: KeyboardEvent) => {
      if (!pressed.delete(event.code)) return
      keyboardSoundPlayer.play(releaseSoundFor(pack, event.code))
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [assets, enabled, pack, active])
  return (code: string) => {
    if (!enabled || !active) return
    void keyboardSoundPlayer.unlock()
    keyboardSoundPlayer.play(pressSoundFor(pack, code))
    window.setTimeout(() => keyboardSoundPlayer.play(releaseSoundFor(pack, code)), 60)
  }
}
