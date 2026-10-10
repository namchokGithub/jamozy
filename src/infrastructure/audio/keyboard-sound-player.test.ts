import { describe, expect, it, vi } from 'vitest'
import { createKeyboardSoundPlayer } from './keyboard-sound-player'

function makeContext() {
  const source = { buffer: null, connect: vi.fn(), start: vi.fn() }
  return {
    state: 'suspended',
    decodeAudioData: vi.fn(async (data: ArrayBuffer) => ({ decoded: data.byteLength })),
    createBufferSource: vi.fn(() => source),
    resume: vi.fn(async () => undefined),
    source,
  }
}

describe('createKeyboardSoundPlayer', () => {
  it('loads each sound URL once and plays decoded buffers independently', async () => {
    const context = makeContext()
    const fetchAudio = vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(1) }))
    const player = createKeyboardSoundPlayer({
      createContext: () => context as never,
      fetchAudio,
    })
    const assets = { 'press/GENERIC_R2': '/sound.mp3' }

    await Promise.all([player.load(assets), player.load(assets)])
    player.play('press/GENERIC_R2')

    expect(fetchAudio).toHaveBeenCalledOnce()
    expect(context.source.start).toHaveBeenCalledOnce()
  })

  it('does not throw before a sound has loaded and resumes a suspended context', async () => {
    const context = makeContext()
    const player = createKeyboardSoundPlayer({
      createContext: () => context as never,
      fetchAudio: vi.fn(),
    })

    expect(() => player.play('press/GENERIC_R2')).not.toThrow()
    await player.unlock()

    expect(context.resume).toHaveBeenCalledOnce()
  })

  it('uses the newly selected pack when the same sound name has a different URL', async () => {
    const context = makeContext()
    const playedBuffers: unknown[] = []
    context.source.start.mockImplementation(() => playedBuffers.push(context.source.buffer))
    context.decodeAudioData.mockImplementation(async (data) => ({ decoded: data.byteLength }))
    const player = createKeyboardSoundPlayer({
      createContext: () => context as never,
      fetchAudio: async (url) => ({ arrayBuffer: async () => new ArrayBuffer(url === '/turquoise.mp3' ? 1 : 2) }),
    })

    await player.load({ 'press/GENERIC_R2': '/turquoise.mp3' })
    player.play('press/GENERIC_R2')
    await player.load({ 'press/GENERIC_R2': '/mxblue.mp3' })
    player.play('press/GENERIC_R2')

    expect(playedBuffers).toEqual([{ decoded: 1 }, { decoded: 2 }])
  })
})
