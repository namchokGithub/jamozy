import type { ActionFunctionArgs } from 'react-router'
import { updateDisplayName } from '../../application/update-display-name'
import type { UserProfileRepository } from '../../domain/repositories/user-profile-repository'

export function createCourseListAction(deps: { userProfileRepo: UserProfileRepository; ensureUser: () => Promise<{ uid: string }> }) {
  return async ({ request }: ActionFunctionArgs) => {
    const { displayName } = await request.json() as { displayName: string }
    const user = await deps.ensureUser()
    const profile = await updateDisplayName(deps.userProfileRepo, user.uid, displayName)
    return { displayName: profile.displayName }
  }
}
