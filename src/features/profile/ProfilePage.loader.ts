import {
  getProfileSummary,
  type ProfileSummary,
} from '../../application/get-profile-summary'
import type { UserProfileRepository } from '../../domain/repositories/user-profile-repository'

export interface ProfileLoaderData {
  summary: ProfileSummary
}

export function createProfileLoader(deps: {
  userProfileRepo: UserProfileRepository
  ensureUser: () => Promise<{ uid: string }>
}) {
  return async (): Promise<ProfileLoaderData> => {
    const user = await deps.ensureUser()
    const summary = await getProfileSummary(deps.userProfileRepo, user.uid)
    return { summary }
  }
}
