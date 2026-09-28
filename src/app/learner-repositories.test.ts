import { describe, expect, it } from 'vitest'
import { createLearnerRepositories } from './learner-repositories'
import { FakeProgressRepository, FakeReviewRepository, FakeUserProfileRepository } from '../test/fakes'

describe('createLearnerRepositories', () => {
  it('uses Guest adapters for an active Guest session', async () => {
    const guestProgress = new FakeProgressRepository()
    const app = createLearnerRepositories({ sessions: { getActiveSession: async () => ({ kind: 'guest', userId: 'guest-id' as const }) }, guest: { progressRepo: guestProgress, reviewRepo: new FakeReviewRepository(), userProfileRepo: new FakeUserProfileRepository() }, authenticated: { progressRepo: new FakeProgressRepository(), reviewRepo: new FakeReviewRepository(), userProfileRepo: new FakeUserProfileRepository() } })
    await app.progressRepo.saveProgress('guest-id', { lessonId: 'lesson', status: 'unlocked', bestAccuracy: 0, bestSpeedWpm: 0, attempts: 0, lastAttemptAt: null, completedAt: null })
    expect(await guestProgress.getProgress('guest-id', 'lesson')).not.toBeNull()
    expect(await app.getActiveUser()).toEqual({ uid: 'guest-id' })
  })
})
