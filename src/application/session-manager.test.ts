import { describe, expect, it } from 'vitest'
import { SessionManager } from './session-manager'

describe('SessionManager', () => {
  it('uses the authenticated user before the Guest session', async () => {
    const manager = new SessionManager({ getCurrentUser: () => ({ uid: 'cloud-id', displayName: null }), signUpWithEmail: async () => ({ uid: '', displayName: null }), signInWithEmail: async () => ({ uid: '', displayName: null }), signInWithGoogle: async () => ({ uid: '', displayName: null }), signOut: async () => {}, onAuthStateChanged: () => () => {} }, { getActiveSession: async () => ({ kind: 'guest', userId: 'guest-id' }) })
    expect(await manager.getActiveSession()).toEqual({ kind: 'authenticated', userId: 'cloud-id' })
  })

  it('falls back to the existing Guest session after sign-out', async () => {
    const manager = new SessionManager({ getCurrentUser: () => null, signUpWithEmail: async () => ({ uid: '', displayName: null }), signInWithEmail: async () => ({ uid: '', displayName: null }), signInWithGoogle: async () => ({ uid: '', displayName: null }), signOut: async () => {}, onAuthStateChanged: () => () => {} }, { getActiveSession: async () => ({ kind: 'guest', userId: 'guest-id' }) })
    expect(await manager.getActiveSession()).toEqual({ kind: 'guest', userId: 'guest-id' })
  })
})
