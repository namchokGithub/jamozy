import { describe, expect, it, vi } from 'vitest'
import { getSettings } from './get-settings'
import { FakeUserProfileRepository } from '../test/fakes'
import { defaultUserProfile, type UserProfile } from '../domain/models/user-profile'

describe('getSettings', () => {
  it("returns an existing profile's settings unchanged", async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const profile: UserProfile = {
      ...defaultUserProfile('user1', new Date('2025-01-01')),
      settings: {
        soundEnabled: false,
        showKeyboard: true,
        showEnglishKeys: false,
        keyboardOpacity: 0.3,
        romanizationEnabled: false,
        meaningLanguage: 'en',
        theme: 'dark',
      },
    }
    await userProfileRepo.saveUserProfile('user1', profile)

    const settings = await getSettings(userProfileRepo, 'user1')

    expect(settings).toEqual(profile.settings)
  })

  it('returns default settings, not null, for a user with no profile yet', async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const now = new Date('2026-01-01')

    const settings = await getSettings(userProfileRepo, 'user1', now)

    expect(settings).toEqual(defaultUserProfile('user1', now).settings)
  })

  it('never writes anything (a GET must stay a pure read)', async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const saveSpy = vi.spyOn(userProfileRepo, 'saveUserProfile')

    await getSettings(userProfileRepo, 'user1')

    expect(saveSpy).not.toHaveBeenCalled()
  })
})
