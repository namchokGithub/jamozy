import { describe, expect, it } from 'vitest'
import { toUserProfile } from './firebase-user-profile-repository'
import { defaultUserProfile } from '../../../domain/models/user-profile'

const createdAt = { toDate: () => new Date('2026-01-01') }

describe('toUserProfile', () => {
  it('fills missing stats and settings with defaults', () => {
    const defaults = defaultUserProfile('user1', new Date('2026-01-01'))
    const profile = toUserProfile('user1', { exp: 5, createdAt })
    expect(profile.stats).toEqual(defaults.stats)
    expect(profile.settings).toEqual(defaults.settings)
    expect(profile.exp).toBe(5)
  })

  it('reads a missing exp as zero', () => {
    expect(toUserProfile('user1', { createdAt }).exp).toBe(0)
  })

  it('adds Turquoise Tealio to legacy settings without a selected pack', () => {
    const legacySettings = defaultUserProfile('user1', new Date('2026-01-01')).settings
    delete (legacySettings as Partial<typeof legacySettings>).keyboardSoundPack

    expect(toUserProfile('user1', { createdAt, settings: legacySettings }).settings).toMatchObject({
      keyboardSoundPack: 'turquoise',
    })
  })
})
