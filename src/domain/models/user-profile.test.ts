import { describe, expect, it } from 'vitest'
import {
  defaultUserProfile,
  expRequiredForNextLevel,
  levelFromExp,
  levelProgress,
  normalizeUserSettings,
  totalExp,
  userSettingsSchema,
} from './user-profile'

describe('expRequiredForNextLevel', () => {
  it('follows 50 × level^1.2 below the soft cap', () => {
    expect(expRequiredForNextLevel(1)).toBe(50)
    expect(expRequiredForNextLevel(2)).toBe(115)
    expect(expRequiredForNextLevel(99)).toBe(12409)
  })

  it('triples at Level 100 and again every ten levels', () => {
    expect(expRequiredForNextLevel(100)).toBe(37678)
    expect(expRequiredForNextLevel(109)).toBe(Math.round(50 * 109 ** 1.2 * 3))
    expect(expRequiredForNextLevel(110)).toBe(Math.round(50 * 110 ** 1.2 * 9))
  })

  it('scales by 15% per rebirth', () => {
    expect(expRequiredForNextLevel(1, 2)).toBe(65)
  })
})

describe('levelFromExp', () => {
  it('starts at level 1 with no exp', () => {
    expect(levelFromExp(0)).toBe(1)
  })

  it('levels up when cumulative exp reaches each requirement', () => {
    expect(levelFromExp(49)).toBe(1)
    expect(levelFromExp(50)).toBe(2)
    expect(levelFromExp(164)).toBe(2)
    expect(levelFromExp(165)).toBe(3)
  })

  it('needs more exp per level after a rebirth', () => {
    expect(levelFromExp(50, 1)).toBe(1)
    expect(levelFromExp(58, 1)).toBe(2)
  })

  it('treats negative or non-finite exp as zero', () => {
    expect(levelFromExp(-10)).toBe(1)
    expect(levelFromExp(Number.NaN)).toBe(1)
  })
})

describe('levelProgress', () => {
  it('reports exp into the level and the exp the level requires', () => {
    expect(levelProgress(0)).toEqual({
      level: 1,
      expIntoLevel: 0,
      expToNextLevel: 50,
    })
    expect(levelProgress(650)).toEqual({
      level: 5,
      expIntoLevel: 34,
      expToNextLevel: 345,
    })
  })
})

describe('totalExp', () => {
  it('adds session-tracked exp to the legacy profile exp', () => {
    const profile = defaultUserProfile('user1', new Date('2026-01-01'))
    expect(totalExp(profile)).toBe(0)
    expect(
      totalExp({
        ...profile,
        exp: 100,
        sessionAggregate: {
          exp: 30,
          exercisesAttempted: 0,
          acceptedKeystrokes: 0,
          rejectedKeystrokes: 0,
          totalTypingTimeSeconds: 0,
          bestAccuracy: 0,
        },
      }),
    ).toBe(130)
  })
})

describe('defaultUserProfile', () => {
  it('returns a zeroed profile with the default settings', () => {
    const now = new Date('2026-01-01')
    const profile = defaultUserProfile('user1', now)

    expect(profile).toEqual({
      id: 'user1',
      displayName: 'Guest',
      exp: 0,
      settings: {
        soundEnabled: true,
        keyboardSoundPack: 'turquoise',
        showKeyboard: true,
        showEnglishKeys: true,
        keyboardOpacity: 0.7,
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
      updatedAt: now,
    })
  })
})

function makeValidSettings() {
  return {
    soundEnabled: true,
    keyboardSoundPack: 'turquoise' as const,
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
      userSettingsSchema.parse({
        ...makeValidSettings(),
        keyboardOpacity: 1.5,
      }),
    ).toThrow()
  })

  it('rejects an invalid meaningLanguage value', () => {
    expect(() =>
      userSettingsSchema.parse({
        ...makeValidSettings(),
        meaningLanguage: 'invalid',
      }),
    ).toThrow()
  })

  it('rejects an invalid theme value', () => {
    expect(() =>
      userSettingsSchema.parse({ ...makeValidSettings(), theme: 'blue' }),
    ).toThrow()
  })

  it('rejects an invalid keyboard sound pack', () => {
    expect(() =>
      userSettingsSchema.parse({ ...makeValidSettings(), keyboardSoundPack: 'bluealps' }),
    ).toThrow()
  })
})

describe('normalizeUserSettings', () => {
  it('adds the Turquoise Tealio default to legacy settings without changing other preferences', () => {
    const legacySettings = {
      soundEnabled: false,
      showKeyboard: true,
      showEnglishKeys: false,
      keyboardOpacity: 0.3,
      romanizationEnabled: false,
      meaningLanguage: 'en' as const,
      theme: 'dark' as const,
    }

    expect(normalizeUserSettings(legacySettings)).toEqual({
      ...legacySettings,
      keyboardSoundPack: 'turquoise',
    })
  })
})
