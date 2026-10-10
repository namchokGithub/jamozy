import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useResolvedSoundSettings } from './useResolvedSoundSettings'

describe('useResolvedSoundSettings', () => {
  it('keeps sound silent until persisted settings resolve, then applies the selected pack', async () => {
    let resolveSettings: (settings: { soundEnabled: boolean; keyboardSoundPack: 'mxblue' }) => void = () => {}
    const settings = new Promise<{ soundEnabled: boolean; keyboardSoundPack: 'mxblue' }>((resolve) => {
      resolveSettings = resolve
    })
    const { result } = renderHook(() => useResolvedSoundSettings(settings))

    expect(result.current.soundEnabled).toBe(false)
    await act(async () => resolveSettings({ soundEnabled: true, keyboardSoundPack: 'mxblue' }))
    expect(result.current).toEqual({ soundEnabled: true, keyboardSoundPack: 'mxblue' })
  })
})
