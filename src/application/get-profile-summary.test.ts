import { describe, expect, it, vi } from 'vitest'
import { getProfileSummary } from './get-profile-summary'
import { FakeUserProfileRepository } from '../test/fakes'
import {
  defaultUserProfile,
  type UserProfile,
  type UserStats,
} from '../domain/models/user-profile'
import { emptySessionAggregate } from '../domain/models/session-aggregate'

const sampleStats: UserStats = {
  lessonsCompleted: 12,
  wordsPracticed: 84,
  averageAccuracy: 91.5,
  bestAccuracy: 100,
  averageSpeedWpm: 22,
  totalTypingTimeSeconds: 3600,
}

describe('getProfileSummary', () => {
  it('returns zeroed exp/level/stats for a user with no profile yet', async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const now = new Date('2026-01-01')

    const summary = await getProfileSummary(userProfileRepo, 'user1', now)

    expect(summary).toEqual({
      exp: 0,
      level: 1,
      stats: defaultUserProfile('user1', now).stats,
      sessionAggregate: emptySessionAggregate(),
    })
  })

  it("returns an existing profile's exp/stats unchanged, with level derived", async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const profile: UserProfile = {
      ...defaultUserProfile('user1', new Date('2025-01-01')),
      exp: 250,
      stats: sampleStats,
    }
    await userProfileRepo.saveUserProfile('user1', profile)

    const summary = await getProfileSummary(userProfileRepo, 'user1')

    expect(summary).toEqual({ exp: 250, level: 3, stats: sampleStats, sessionAggregate: emptySessionAggregate() })
  })

  it('adds raw session counters to compatible totals without averaging legacy values', async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    await userProfileRepo.saveUserProfile('user1', {
      ...defaultUserProfile('user1', new Date('2025-01-01')),
      exp: 250,
      stats: sampleStats,
      sessionAggregate: { exp: 120, exercisesAttempted: 4, acceptedKeystrokes: 30, rejectedKeystrokes: 2, totalTypingTimeSeconds: 90, bestAccuracy: 93.75 },
    })

    const summary = await getProfileSummary(userProfileRepo, 'user1')

    expect(summary.exp).toBe(370)
    expect(summary.stats.wordsPracticed).toBe(88)
    expect(summary.stats.totalTypingTimeSeconds).toBe(3690)
    expect(summary.stats.averageAccuracy).toBe(91.5)
  })

  it('derives level 1 at exp 99 and level 2 at exp 100 (the 100-EXP-per-level boundary)', async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    await userProfileRepo.saveUserProfile('below', {
      ...defaultUserProfile('below', new Date('2025-01-01')),
      exp: 99,
    })
    await userProfileRepo.saveUserProfile('at', {
      ...defaultUserProfile('at', new Date('2025-01-01')),
      exp: 100,
    })

    const below = await getProfileSummary(userProfileRepo, 'below')
    const at = await getProfileSummary(userProfileRepo, 'at')

    expect(below.level).toBe(1)
    expect(at.level).toBe(2)
  })

  it('never writes anything (a GET must stay a pure read)', async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const saveSpy = vi.spyOn(userProfileRepo, 'saveUserProfile')

    await getProfileSummary(userProfileRepo, 'user1')

    expect(saveSpy).not.toHaveBeenCalled()
  })
})
