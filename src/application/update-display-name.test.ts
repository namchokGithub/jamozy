import { describe, expect, it } from 'vitest'
import { updateDisplayName } from './update-display-name'
import { FakeUserProfileRepository } from '../test/fakes'
import { defaultUserProfile } from '../domain/models/user-profile'

describe('updateDisplayName', () => {
  it('updates the name without changing the identity', async () => {
    const repo = new FakeUserProfileRepository()
    await repo.saveUserProfile('guest-id', defaultUserProfile('guest-id', new Date('2026-01-01'), 'Guest#0042'))
    const updated = await updateDisplayName(repo, 'guest-id', ' Pech ', new Date('2026-01-02'))
    expect(updated.displayName).toBe('Pech')
    expect(updated.id).toBe('guest-id')
  })
})
