import { describe, expect, it } from 'vitest'
import { updateSettings } from './update-settings'
import { FakeUserProfileRepository } from '../test/fakes'
import { defaultUserProfile, type UserProfile, type UserSettings } from '../domain/models/user-profile'

function makeSettings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    soundEnabled: false,
    showKeyboard: false,
    showEnglishKeys: false,
    keyboardOpacity: 0.2,
    romanizationEnabled: false,
    meaningLanguage: 'th',
    theme: 'dark',
    ...overrides,
  }
}

describe('updateSettings', () => {
  const now = new Date('2026-01-05')

  it('replaces only .settings on an existing profile, leaving exp/stats/createdAt untouched', async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const existing: UserProfile = {
      id: 'user1',
      exp: 350,
      settings: defaultUserProfile('user1', new Date('2025-01-01')).settings,
      stats: {
        lessonsCompleted: 4,
        wordsPracticed: 12,
        averageAccuracy: 88,
        bestAccuracy: 100,
        averageSpeedWpm: 25,
        totalTypingTimeSeconds: 900,
      },
      createdAt: new Date('2025-01-01'),
    }
    await userProfileRepo.saveUserProfile('user1', existing)

    const newSettings = makeSettings()
    await updateSettings(userProfileRepo, 'user1', newSettings, now)

    const updated = await userProfileRepo.getUserProfile('user1')
    expect(updated?.settings).toEqual(newSettings)
    expect(updated?.exp).toBe(350)
    expect(updated?.stats).toEqual(existing.stats)
    expect(updated?.createdAt).toEqual(existing.createdAt)
  })

  it('creates a new profile from defaultUserProfile when none exists yet, with the submitted settings', async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const newSettings = makeSettings()

    await updateSettings(userProfileRepo, 'user1', newSettings, now)

    const created = await userProfileRepo.getUserProfile('user1')
    expect(created?.settings).toEqual(newSettings)
    expect(created?.exp).toBe(0)
    expect(created?.stats).toEqual(defaultUserProfile('user1', now).stats)
    expect(created?.createdAt).toEqual(now)
  })
})
