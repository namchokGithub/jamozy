import { describe, expect, it, vi } from 'vitest'
import { createCourseListAction } from './CourseListPage.action'
import { FakeUserProfileRepository } from '../../test/fakes'

describe('createCourseListAction', () => {
  it('migrates the Guest captured before successful sign-in', async () => {
    const auth = { signInWithEmail: vi.fn().mockResolvedValue({ uid: 'account-1', displayName: 'Learner' }), signUpWithEmail: vi.fn(), signInWithGoogle: vi.fn(), signOut: vi.fn(), getCurrentUser: () => null, onAuthStateChanged: () => () => {} }
    const migrateGuestData = vi.fn().mockResolvedValue(undefined)
    const action = createCourseListAction({ userProfileRepo: new FakeUserProfileRepository(), ensureUser: async () => ({ uid: 'guest-1' }), getActiveSession: async () => ({ kind: 'guest', userId: 'guest-1' }), auth, migrateGuestData })

    await action({ request: new Request('http://localhost', { method: 'POST', body: JSON.stringify({ intent: 'sign-in', email: 'a@example.com', password: 'password' }) }) } as never)

    expect(migrateGuestData).toHaveBeenCalledWith('guest-1', 'account-1')
  })

  it('keeps authentication successful when migration fails', async () => {
    const auth = { signInWithEmail: vi.fn().mockResolvedValue({ uid: 'account-1', displayName: 'Learner' }), signUpWithEmail: vi.fn(), signInWithGoogle: vi.fn(), signOut: vi.fn(), getCurrentUser: () => null, onAuthStateChanged: () => () => {} }
    const action = createCourseListAction({ userProfileRepo: new FakeUserProfileRepository(), ensureUser: async () => ({ uid: 'guest-1' }), getActiveSession: async () => ({ kind: 'guest', userId: 'guest-1' }), auth, migrateGuestData: vi.fn().mockRejectedValue(new Error('offline')) })

    await expect(action({ request: new Request('http://localhost', { method: 'POST', body: JSON.stringify({ intent: 'sign-in', email: 'a@example.com', password: 'password' }) }) } as never)).resolves.toMatchObject({ authenticated: true, migrationError: 'offline' })
  })
})
