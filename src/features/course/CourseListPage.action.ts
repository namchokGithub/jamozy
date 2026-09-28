import type { ActionFunctionArgs } from 'react-router'
import { updateDisplayName } from '../../application/update-display-name'
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from '../../application/authenticate'
import type { UserProfileRepository } from '../../domain/repositories/user-profile-repository'
import type { AuthRepository } from '../../domain/repositories/auth-repository'

export function createCourseListAction(deps: { userProfileRepo: UserProfileRepository; ensureUser: () => Promise<{ uid: string }>; auth?: AuthRepository }) {
  return async ({ request }: ActionFunctionArgs) => {
    const body = await request.json() as { displayName?: string; intent?: string; email?: string; password?: string }
    if (body.intent && deps.auth) {
      try { if (body.intent === 'sign-up') await signUpWithEmail(deps.auth, deps.userProfileRepo, body.email ?? '', body.password ?? ''); else if (body.intent === 'sign-in') await signInWithEmail(deps.auth, deps.userProfileRepo, body.email ?? '', body.password ?? ''); else if (body.intent === 'google') await signInWithGoogle(deps.auth, deps.userProfileRepo); else await deps.auth.signOut(); return { authenticated: true } } catch (error) { return { error: error instanceof Error ? error.message : 'Unable to sign in' } }
    }
    const displayName = body.displayName ?? ''
    const user = await deps.ensureUser()
    const profile = await updateDisplayName(deps.userProfileRepo, user.uid, displayName)
    return { displayName: profile.displayName }
  }
}
