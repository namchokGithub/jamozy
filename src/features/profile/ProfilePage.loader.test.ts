import { describe, expect, it, vi } from 'vitest'
import { createProfileLoader } from './ProfilePage.loader'
import { FakeUserProfileRepository } from '../../test/fakes'
import { defaultUserProfile } from '../../domain/models/user-profile'

describe('createProfileLoader', () => {
  it('signs in, then returns zeroed exp/level/stats for a brand-new user', async () => {
    const ensureUser = vi.fn().mockResolvedValue({ uid: 'user1' })
    const userProfileRepo = new FakeUserProfileRepository()
    const loader = createProfileLoader({ userProfileRepo, ensureUser })

    const data = await loader()

    expect(ensureUser).toHaveBeenCalledOnce()
    expect(data.summary.exp).toBe(0)
    expect(data.summary.level).toBe(1)
    expect(data.summary.stats.lessonsCompleted).toBe(0)
  })

  it("returns an existing user's real exp/stats", async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const profile = defaultUserProfile('user1', new Date('2025-01-01'))
    await userProfileRepo.saveUserProfile('user1', {
      ...profile,
      exp: 150,
      stats: { ...profile.stats, lessonsCompleted: 5 },
    })
    const loader = createProfileLoader({
      userProfileRepo,
      ensureUser: vi.fn().mockResolvedValue({ uid: 'user1' }),
    })

    const data = await loader()

    expect(data.summary.exp).toBe(150)
    expect(data.summary.level).toBe(2)
    expect(data.summary.stats.lessonsCompleted).toBe(5)
  })
})
