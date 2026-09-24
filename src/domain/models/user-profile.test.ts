import { describe, expect, it } from 'vitest'
import { defaultUserProfile, levelFromExp, userSettingsSchema } from './user-profile'

describe('levelFromExp', () => {
  it('starts at level 1 with no exp', () => {
    expect(levelFromExp(0)).toBe(1)
  })

  it('levels up every 100 exp', () => {
    expect(levelFromExp(99)).toBe(1)
    expect(levelFromExp(100)).toBe(2)
    expect(levelFromExp(250)).toBe(3)
  })
})

describe('defaultUserProfile', () => {
  it('returns a zeroed profile with the default settings', () => {
    const now = new Date('2026-01-01')
    const profile = defaultUserProfile('user1', now)

    expect(profile).toEqual({
      id: 'user1',
      exp: 0,
      settings: {
        soundEnabled: true,
        showKeyboard: true,
        showEnglishKeys: true,
        keyboardOpacity: 1,
        romanizationEnabled: true,
        meaningLanguage: 'both',
        theme: 'light',
      },
      stats: {
        lessonsCompleted: 0,
        wordsPracticed: 0,
        averageAccuracy: 0,
        bestAccuracy: 0,
        averageSpeedWpm: 0,
        totalTypingTimeSeconds: 0,
      },
      createdAt: now,
    })
  })
})

function makeValidSettings() {
  return {
    soundEnabled: true,
    showKeyboard: true,
    showEnglishKeys: true,
    keyboardOpacity: 0.5,
    romanizationEnabled: true,
    meaningLanguage: 'both' as const,
    theme: 'light' as const,
  }
}

describe('userSettingsSchema', () => {
  it('accepts a valid settings object', () => {
    expect(() => userSettingsSchema.parse(makeValidSettings())).not.toThrow()
  })

  it('rejects an out-of-range keyboardOpacity', () => {
    expect(() =>
      userSettingsSchema.parse({ ...makeValidSettings(), keyboardOpacity: 1.5 }),
    ).toThrow()
  })

  it('rejects an invalid meaningLanguage value', () => {
    expect(() =>
      userSettingsSchema.parse({ ...makeValidSettings(), meaningLanguage: 'invalid' }),
    ).toThrow()
  })

  it('rejects an invalid theme value', () => {
    expect(() => userSettingsSchema.parse({ ...makeValidSettings(), theme: 'blue' })).toThrow()
  })
})
