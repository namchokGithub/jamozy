import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, resolveTheme, THEME_STORAGE_KEY } from './apply-theme'

function stubPrefersDark(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches, media: query })),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  delete document.documentElement.dataset.theme
  delete document.documentElement.dataset.themeSetting
})

describe('resolveTheme', () => {
  it('keeps an explicit light or dark choice whatever the device prefers', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('follows the device preference for system', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})

describe('applyTheme', () => {
  it('paints an explicit theme and remembers it on this device', () => {
    stubPrefersDark(true)

    applyTheme('light')

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.dataset.themeSetting).toBe('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })

  it('paints the device preference for system but remembers the choice', () => {
    stubPrefersDark(true)

    applyTheme('system')

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.dataset.themeSetting).toBe('system')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system')
  })

  it('falls back to light for system when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)

    applyTheme('system')

    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
