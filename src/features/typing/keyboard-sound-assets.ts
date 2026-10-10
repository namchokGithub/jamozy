import type { KeyboardSoundPack } from '../../domain/models/user-profile'
import type { KeyboardSoundName } from './keyboard-sound-map'

const bundledAudio = import.meta.glob<string>('../../assets/audio/*/*/*.mp3', {
  eager: true,
  query: '?url&no-inline',
  import: 'default',
})

export function keyboardSoundAssets(
  pack: KeyboardSoundPack,
): Partial<Record<KeyboardSoundName, string>> {
  return Object.fromEntries(
    Object.entries(bundledAudio)
      .filter(([path]) => path.includes(`/audio/${pack}/`))
      .map(([path, url]) => [
        path.slice(path.lastIndexOf(`/${pack}/`) + pack.length + 2, -4),
        url,
      ]),
  ) as Partial<Record<KeyboardSoundName, string>>
}
