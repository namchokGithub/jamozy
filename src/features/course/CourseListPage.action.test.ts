import { describe, expect, it, vi } from 'vitest'
import { createCourseListAction } from './CourseListPage.action'
import { FakeUserProfileRepository } from '../../test/fakes'

describe('createCourseListAction', () => {
  it('reports successful sign-in without starting a second guest migration', async () => {
    const auth = {
      signInWithEmail: vi
        .fn()
        .mockResolvedValue({ uid: 'account-1', displayName: 'Learner' }),
      signUpWithEmail: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
      getCurrentUser: () => null,
      waitForInitialAuthState: async () => {},
      onAuthStateChanged: () => () => {},
    }
    const action = createCourseListAction({
      userProfileRepo: new FakeUserProfileRepository(),
      ensureUser: async () => ({ uid: 'guest-1' }),
      auth,
    })

    await expect(
      action({
        request: new Request('http://localhost', {
          method: 'POST',
          body: JSON.stringify({
            intent: 'sign-in',
            email: 'a@example.com',
            password: 'password',
          }),
        }),
      } as never),
    ).resolves.toEqual({ authenticated: true })
  })
})
