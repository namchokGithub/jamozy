import type { KeyboardSoundName } from '../../features/typing/keyboard-sound-map'

type SoundAssets = Partial<Record<KeyboardSoundName, string>>

interface KeyboardSoundPlayerDependencies {
  createContext: () => AudioContext
  fetchAudio: (url: string) => Promise<{ arrayBuffer(): Promise<ArrayBuffer> }>
}

export function createKeyboardSoundPlayer({
  createContext,
  fetchAudio,
}: KeyboardSoundPlayerDependencies) {
  let context: AudioContext | null = null
  const buffers = new Map<string, AudioBuffer>()
  const loading = new Map<string, Promise<void>>()
  let activeAssets: SoundAssets = {}

  const getContext = () => (context ??= createContext())

  return {
    async load(assets: SoundAssets) {
      activeAssets = assets
      await Promise.all(
        Object.values(assets).map(async (url) => {
          if (!url || buffers.has(url)) return
          const request = loading.get(url) ?? fetchAudio(url)
            .then((response) => response.arrayBuffer())
            .then((data) => getContext().decodeAudioData(data))
            .then((buffer) => {
              buffers.set(url, buffer)
            })
            .catch(() => undefined)
          loading.set(url, request)
          await request
        }),
      )
    },
    play(name: KeyboardSoundName) {
      const url = activeAssets[name]
      const buffer = url ? buffers.get(url) : undefined
      if (!buffer) return
      try {
        const source = getContext().createBufferSource()
        source.buffer = buffer
        source.connect(getContext().destination)
        source.start()
      } catch {
        // Audio failures are non-blocking feedback only.
      }
    },
    async unlock() {
      try {
        const current = getContext()
        if (current.state === 'suspended') await current.resume()
      } catch {
        // Unsupported or blocked audio stays silent.
      }
    },
  }
}

export const keyboardSoundPlayer = createKeyboardSoundPlayer({
  createContext: () => new AudioContext(),
  fetchAudio: (url) => fetch(url),
})
