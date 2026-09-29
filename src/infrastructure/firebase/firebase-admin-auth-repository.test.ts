import { describe, expect, it } from 'vitest'
import { FirebaseAdminAuthRepository } from './firebase-admin-auth-repository'

describe('FirebaseAdminAuthRepository', () => {
  it('returns false without a signed-in user', async () => {
    await expect(
      new FirebaseAdminAuthRepository(() => null, async () => undefined).isCurrentUserAdmin(),
    ).resolves.toBe(false)
  })

  it('returns true only for an admin custom claim', async () => {
    const admin = new FirebaseAdminAuthRepository(() => ({ getIdTokenResult: async () => ({ claims: { admin: true } }) }), async () => undefined)
    const learner = new FirebaseAdminAuthRepository(() => ({ getIdTokenResult: async () => ({ claims: { admin: false } }) }), async () => undefined)
    await expect(admin.isCurrentUserAdmin()).resolves.toBe(true)
    await expect(learner.isCurrentUserAdmin()).resolves.toBe(false)
  })
})
