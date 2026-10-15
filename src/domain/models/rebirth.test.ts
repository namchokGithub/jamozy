import { describe, expect, it } from 'vitest'
import { rebirthProfile } from './rebirth'
import { defaultUserProfile, expRequiredForNextLevel } from './user-profile'

const expAtLevel = (level: number) =>
  Array.from({ length: level - 1 }, (_, index) =>
    expRequiredForNextLevel(index + 1),
  ).reduce((total, exp) => total + exp, 0)

describe('rebirthProfile', () => {
  it('resets an eligible cycle and awards exactly one persisted Perk Point', () => {
    const profile = defaultUserProfile('u1', new Date('2026-01-01'))
    profile.progression = {
      currentExp: 800000,
      totalExpEarned: 800000,
      highestLevel: 100,
      rebirthCount: 0,
      perkPointsEarned: 0,
    }

    const result = rebirthProfile(profile, 'rebirth-1', new Date('2026-10-14'))

    expect(result).toMatchObject({
      record: { id: 'rebirth-1', rebirthNumber: 1 },
      profile: {
        progression: {
          currentExp: 0,
          totalExpEarned: 800000,
          rebirthCount: 1,
          perkPointsEarned: 1,
        },
      },
    })
  })

  it('rejects a Level 99 cycle', () => {
    const profile = defaultUserProfile('u1', new Date())
    profile.progression = {
      ...profile.progression!,
      currentExp: expAtLevel(99),
      totalExpEarned: expAtLevel(99),
      highestLevel: 99,
    }
    expect(rebirthProfile(profile, 'rebirth-1', new Date())).toEqual({
      level: 99,
    })
  })

  it('accepts an exact Level 100 cycle', () => {
    const profile = defaultUserProfile('u1', new Date())
    profile.progression = {
      ...profile.progression!,
      currentExp: expAtLevel(100),
      totalExpEarned: expAtLevel(100),
      highestLevel: 100,
    }
    expect(rebirthProfile(profile, 'rebirth-1', new Date())).toMatchObject({
      record: { rebirthNumber: 1, levelAtRebirth: 100 },
      profile: {
        progression: { currentExp: 0, rebirthCount: 1, perkPointsEarned: 1 },
      },
    })
  })
})
