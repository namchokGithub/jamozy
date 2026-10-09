import { describe, expect, it } from 'vitest'
import { createLearnerRepositories } from './learner-repositories'
import { FakeJamoStatsRepository, FakeProgressRepository, FakeReviewRepository, FakeSessionSubmissionRepository, FakeUserProfileRepository } from '../test/fakes'

describe('createLearnerRepositories', () => {
  it('uses Guest adapters for an active Guest session', async () => {
    const guestProgress = new FakeProgressRepository()
    const app = createLearnerRepositories({ sessions: { getActiveSession: async () => ({ kind: 'guest', userId: 'guest-id' as const }) }, guest: { progressRepo: guestProgress, reviewRepo: new FakeReviewRepository(), userProfileRepo: new FakeUserProfileRepository(), sessionSubmissionRepo: new FakeSessionSubmissionRepository(), jamoStatsRepo: new FakeJamoStatsRepository({ 'guest-id': { ㄱ: { acceptedKeystrokes: 1, rejectedKeystrokes: 0, firstPracticedAt: new Date(0), lastPracticedAt: new Date(0) } } }) }, authenticated: { progressRepo: new FakeProgressRepository(), reviewRepo: new FakeReviewRepository(), userProfileRepo: new FakeUserProfileRepository(), sessionSubmissionRepo: new FakeSessionSubmissionRepository(), jamoStatsRepo: new FakeJamoStatsRepository() } })
    await app.progressRepo.saveProgress('guest-id', { lessonId: 'lesson', status: 'unlocked', bestAccuracy: 0, bestSpeedWpm: 0, attempts: 0, lastAttemptAt: null, completedAt: null })
    expect(await guestProgress.getProgress('guest-id', 'lesson')).not.toBeNull()
    expect(await app.getActiveUser()).toEqual({ uid: 'guest-id' })
    expect(Object.keys(await app.jamoStatsRepo.getJamoStats('guest-id'))).toEqual(['ㄱ'])
  })
})
