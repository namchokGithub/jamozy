import type { AuthRepository, AuthenticatedUser } from '../domain/repositories/auth-repository'
import { defaultUserProfile } from '../domain/models/user-profile'
import type { UserProfileRepository } from '../domain/repositories/user-profile-repository'

async function ensureProfile(repo: UserProfileRepository, user: AuthenticatedUser) {
  if (!(await repo.getUserProfile(user.uid))) await repo.saveUserProfile(user.uid, defaultUserProfile(user.uid, new Date(), user.displayName ?? 'Learner'))
  return user
}
export const signUpWithEmail = (auth: AuthRepository, profiles: UserProfileRepository, email: string, password: string) => auth.signUpWithEmail(email, password).then((user) => ensureProfile(profiles, user))
export const signInWithEmail = (auth: AuthRepository, profiles: UserProfileRepository, email: string, password: string) => auth.signInWithEmail(email, password).then((user) => ensureProfile(profiles, user))
export const signInWithGoogle = (auth: AuthRepository, profiles: UserProfileRepository) => auth.signInWithGoogle().then((user) => ensureProfile(profiles, user))
