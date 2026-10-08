import { describe, expect, it } from 'vitest'
import { SessionManager } from './session-manager'

describe('SessionManager', () => {
  it('uses the authenticated user before the Guest session', async () => {
    const manager = new SessionManager(
      {
        getCurrentUser: () => ({ uid: 'cloud-id', displayName: null }),
        signUpWithEmail: async () => ({ uid: '', displayName: null }),
        signInWithEmail: async () => ({ uid: '', displayName: null }),
        signInWithGoogle: async () => ({ uid: '', displayName: null }),
        signOut: async () => {},
        waitForInitialAuthState: async () => {},
        onAuthStateChanged: () => () => {},
      },
      { getActiveSession: async () => ({ kind: 'guest', userId: 'guest-id' }) },
    )
    expect(await manager.getActiveSession()).toEqual({
      kind: 'authenticated',
      userId: 'cloud-id',
    })
  })

  it('falls back to the existing Guest session after sign-out', async () => {
    const manager = new SessionManager(
      {
        getCurrentUser: () => null,
        signUpWithEmail: async () => ({ uid: '', displayName: null }),
        signInWithEmail: async () => ({ uid: '', displayName: null }),
        signInWithGoogle: async () => ({ uid: '', displayName: null }),
        signOut: async () => {},
        waitForInitialAuthState: async () => {},
        onAuthStateChanged: () => () => {},
      },
      { getActiveSession: async () => ({ kind: 'guest', userId: 'guest-id' }) },
    )
    expect(await manager.getActiveSession()).toEqual({
      kind: 'guest',
      userId: 'guest-id',
    })
  })

  it('waits for Firebase to restore an authenticated session before choosing Guest', async () => {
    let currentUser: { uid: string; displayName: string | null } | null = null
    let resolveInitialState: () => void = () => {}
    const initialState = new Promise<void>((resolve) => {
      resolveInitialState = resolve
    })
    const auth = {
      getCurrentUser: () => currentUser,
      signUpWithEmail: async () => ({ uid: '', displayName: null }),
      signInWithEmail: async () => ({ uid: '', displayName: null }),
      signInWithGoogle: async () => ({ uid: '', displayName: null }),
      signOut: async () => {},
      onAuthStateChanged: () => () => {},
      waitForInitialAuthState: () => initialState,
    }
    const manager = new SessionManager(auth, {
      getActiveSession: async () => ({ kind: 'guest', userId: 'guest-id' }),
    })

    let settled = false
    const session = manager.getActiveSession().then((value) => {
      settled = true
      return value
    })

    await Promise.resolve()
    expect(settled).toBe(false)

    currentUser = { uid: 'cloud-id', displayName: null }
    resolveInitialState()

    await expect(session).resolves.toEqual({
      kind: 'authenticated',
      userId: 'cloud-id',
    })
  })
})
