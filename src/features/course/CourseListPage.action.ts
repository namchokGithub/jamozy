import type { ActionFunctionArgs } from 'react-router'
import { updateDisplayName } from '../../application/update-display-name'
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from '../../application/authenticate'
import type { UserProfileRepository } from '../../domain/repositories/user-profile-repository'
import type { AuthRepository } from '../../domain/repositories/auth-repository'
import type { UserSession } from '../../domain/models/user-session'

export function createCourseListAction(deps: { userProfileRepo: UserProfileRepository; ensureUser: () => Promise<{ uid: string }>; auth?: AuthRepository; getActiveSession?: () => Promise<UserSession>; migrateGuestData?: (guestId: string, accountId: string) => Promise<void> }) {
  return async ({ request }: ActionFunctionArgs) => {
    const body = await request.json() as { displayName?: string; intent?: string; email?: string; password?: string }
    if (body.intent && deps.auth) {
      try {
        if (body.intent === 'sign-out') {
          await deps.auth.signOut()
          return { authenticated: true }
        }
        const active = deps.getActiveSession ? await deps.getActiveSession() : null
        const user = body.intent === 'sign-up'
          ? await signUpWithEmail(deps.auth, deps.userProfileRepo, body.email ?? '', body.password ?? '')
          : body.intent === 'sign-in'
            ? await signInWithEmail(deps.auth, deps.userProfileRepo, body.email ?? '', body.password ?? '')
            : await signInWithGoogle(deps.auth, deps.userProfileRepo)
        try {
          if (active?.kind === 'guest' && deps.migrateGuestData) await deps.migrateGuestData(active.userId, user.uid)
          return { authenticated: true }
        } catch (error) {
          return { authenticated: true, migrationError: error instanceof Error ? error.message : 'Migration will retry later' }
        }
      } catch (error) { return { error: error instanceof Error ? error.message : 'Unable to sign in' } }
    }
    const displayName = body.displayName ?? ''
    const user = await deps.ensureUser()
    const profile = await updateDisplayName(deps.userProfileRepo, user.uid, displayName)
    return { displayName: profile.displayName }
  }
}
