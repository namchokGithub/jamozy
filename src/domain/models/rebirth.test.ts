import { describe, expect, it } from 'vitest'
import { rebirthProfile } from './rebirth'
import { defaultUserProfile } from './user-profile'

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
      profile: { progression: { currentExp: 0, totalExpEarned: 800000, rebirthCount: 1, perkPointsEarned: 1 } },
    })
  })

  it('rejects a level below 100', () => {
    expect(rebirthProfile(defaultUserProfile('u1', new Date()), 'rebirth-1', new Date())).toEqual({ level: 1 })
  })
})
