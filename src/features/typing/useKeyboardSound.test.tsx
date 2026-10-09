import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useKeyboardSound } from './useKeyboardSound'

const { load, unlock, play } = vi.hoisted(() => ({ load: vi.fn(), unlock: vi.fn(), play: vi.fn() }))
vi.mock('../../infrastructure/audio/keyboard-sound-player', () => ({ keyboardSoundPlayer: { load, unlock, play } }))

describe('useKeyboardSound', () => {
  beforeEach(() => vi.clearAllMocks())
  it('plays press and release for a non-repeated physical key', () => {
    renderHook(() => useKeyboardSound(true, 'turquoise'))
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' })))
    act(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyR' })))
    expect(play).toHaveBeenNthCalledWith(1, 'press/GENERIC_R2')
    expect(play).toHaveBeenNthCalledWith(2, 'release/GENERIC')
  })

  it('does not play a repeated keydown or load audio when disabled', () => {
    renderHook(() => useKeyboardSound(false, 'turquoise'))
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', repeat: true })))
    expect(load).not.toHaveBeenCalled()
    expect(play).not.toHaveBeenCalled()
  })

  it('ignores keys that typing hosts reject and stops playing when inactive', () => {
    const { rerender } = renderHook(
      ({ active }) => useKeyboardSound(true, 'turquoise', active),
      { initialProps: { active: true } },
    )
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ControlLeft' })))
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', ctrlKey: true })))
    expect(play).not.toHaveBeenCalled()
    rerender({ active: false })
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' })))
    expect(play).not.toHaveBeenCalled()
  })

  it('plays virtual press followed by release', () => {
    vi.useFakeTimers()
    try {
      const { result } = renderHook(() => useKeyboardSound(true, 'turquoise'))
      act(() => result.current('KeyR'))
      expect(play).toHaveBeenCalledWith('press/GENERIC_R2')
      act(() => vi.advanceTimersByTime(60))
      expect(play).toHaveBeenLastCalledWith('release/GENERIC')
    } finally {
      vi.useRealTimers()
    }
  })
})
