import { describe, expect, it, vi } from 'vitest'
import { createUpdateSettingsAction } from './SettingsPage.action'
import { FakeUserProfileRepository } from '../../test/fakes'

function makeSettingsBody() {
  return {
    soundEnabled: false,
    showKeyboard: true,
    showEnglishKeys: false,
    keyboardOpacity: 0.7,
    romanizationEnabled: true,
    meaningLanguage: 'en',
    theme: 'dark',
  }
}

describe('createUpdateSettingsAction', () => {
  it('signs in, parses the request body, and saves the settings', async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const ensureUser = vi.fn().mockResolvedValue({ uid: 'user1' })
    const action = createUpdateSettingsAction({ userProfileRepo, ensureUser })

    const request = new Request('http://localhost/settings', {
      method: 'POST',
      body: JSON.stringify(makeSettingsBody()),
    })

    const saved = await action({ request } as never)

    expect(ensureUser).toHaveBeenCalledOnce()
    expect(saved).toEqual(makeSettingsBody())
    const profile = await userProfileRepo.getUserProfile('user1')
    expect(profile?.settings).toEqual(makeSettingsBody())
  })

  it('rejects an out-of-range keyboardOpacity', async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const action = createUpdateSettingsAction({
      userProfileRepo,
      ensureUser: vi.fn().mockResolvedValue({ uid: 'user1' }),
    })
    const request = new Request('http://localhost/settings', {
      method: 'POST',
      body: JSON.stringify({ ...makeSettingsBody(), keyboardOpacity: 2 }),
    })

    await expect(action({ request } as never)).rejects.toThrow()
  })

  it('rejects a malformed request body', async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const action = createUpdateSettingsAction({
      userProfileRepo,
      ensureUser: vi.fn().mockResolvedValue({ uid: 'user1' }),
    })
    const request = new Request('http://localhost/settings', {
      method: 'POST',
      body: JSON.stringify({ theme: 'light' }), // missing every other field
    })

    await expect(action({ request } as never)).rejects.toThrow()
  })
})
