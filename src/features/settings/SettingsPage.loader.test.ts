import { describe, expect, it, vi } from 'vitest'
import { createSettingsLoader } from './SettingsPage.loader'
import { FakeUserProfileRepository } from '../../test/fakes'
import { defaultUserProfile } from '../../domain/models/user-profile'

describe('createSettingsLoader', () => {
  it('signs in, then returns the default settings for a brand-new user', async () => {
    const ensureUser = vi.fn().mockResolvedValue({ uid: 'user1' })
    const userProfileRepo = new FakeUserProfileRepository()
    const loader = createSettingsLoader({ userProfileRepo, ensureUser })

    const data = await loader()

    expect(ensureUser).toHaveBeenCalledOnce()
    expect(data.settings).toEqual({
      soundEnabled: true,
      showKeyboard: true,
      showEnglishKeys: true,
      keyboardOpacity: 1,
      romanizationEnabled: true,
      meaningLanguage: 'both',
      theme: 'light',
    })
  })

  it("returns an existing user's saved settings", async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const profile = defaultUserProfile('user1', new Date('2025-01-01'))
    await userProfileRepo.saveUserProfile('user1', {
      ...profile,
      settings: { ...profile.settings, theme: 'dark' },
    })
    const loader = createSettingsLoader({
      userProfileRepo,
      ensureUser: vi.fn().mockResolvedValue({ uid: 'user1' }),
    })

    const data = await loader()

    expect(data.settings.theme).toBe('dark')
  })
})
