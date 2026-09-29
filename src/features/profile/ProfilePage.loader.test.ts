import { describe, expect, it, vi } from 'vitest'
import { createProfileLoader } from './ProfilePage.loader'
import { FakeProgressRepository, FakeUserProfileRepository } from '../../test/fakes'
import { defaultUserProfile } from '../../domain/models/user-profile'

describe('createProfileLoader', () => {
  it('signs in, then returns zeroed exp/level/stats for a brand-new user', async () => {
    const ensureUser = vi.fn().mockResolvedValue({ uid: 'user1' })
    const userProfileRepo = new FakeUserProfileRepository()
    const loader = createProfileLoader({ userProfileRepo, progressRepo: new FakeProgressRepository(), ensureUser })

    const data = await loader()

    expect(ensureUser).toHaveBeenCalledOnce()
    expect(data.summary.exp).toBe(0)
    expect(data.summary.level).toBe(1)
    expect(data.summary.stats.lessonsCompleted).toBe(0)
  })

  it("returns an existing user's exp and derives no completed lessons without progress", async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const profile = defaultUserProfile('user1', new Date('2025-01-01'))
    await userProfileRepo.saveUserProfile('user1', {
      ...profile,
      exp: 150,
      stats: { ...profile.stats, lessonsCompleted: 5 },
    })
    const loader = createProfileLoader({
      userProfileRepo,
      progressRepo: new FakeProgressRepository(),
      ensureUser: vi.fn().mockResolvedValue({ uid: 'user1' }),
    })

    const data = await loader()

    expect(data.summary.exp).toBe(150)
    expect(data.summary.level).toBe(2)
    expect(data.summary.stats.lessonsCompleted).toBe(0)
  })

  it('counts completed lesson progress instead of the profile aggregate', async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const progressRepo = new FakeProgressRepository()
    const profile = defaultUserProfile('user1', new Date('2025-01-01'))
    await userProfileRepo.saveUserProfile('user1', {
      ...profile,
      stats: { ...profile.stats, lessonsCompleted: 99 },
    })
    await progressRepo.saveProgress('user1', { lessonId: 'lesson-1', status: 'completed', bestAccuracy: 100, bestSpeedWpm: 20, attempts: 1, lastAttemptAt: new Date(), completedAt: new Date() })
    await progressRepo.saveProgress('user1', { lessonId: 'lesson-2', status: 'completed', bestAccuracy: 90, bestSpeedWpm: 18, attempts: 1, lastAttemptAt: new Date(), completedAt: new Date() })
    await progressRepo.saveProgress('user1', { lessonId: 'lesson-3', status: 'unlocked', bestAccuracy: 0, bestSpeedWpm: 0, attempts: 0, lastAttemptAt: null, completedAt: null })
    const loader = createProfileLoader({
      userProfileRepo,
      progressRepo,
      ensureUser: vi.fn().mockResolvedValue({ uid: 'user1' }),
    })

    const data = await loader()

    expect(data.summary.stats.lessonsCompleted).toBe(2)
  })
})
