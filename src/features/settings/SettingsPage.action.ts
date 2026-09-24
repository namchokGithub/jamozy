import type { ActionFunctionArgs } from 'react-router'
import { updateSettings } from '../../application/update-settings'
import { userSettingsSchema, type UserSettings } from '../../domain/models/user-profile'
import type { UserProfileRepository } from '../../domain/repositories/user-profile-repository'

export function createUpdateSettingsAction(deps: {
  userProfileRepo: UserProfileRepository
  ensureUser: () => Promise<{ uid: string }>
}) {
  return async ({ request }: ActionFunctionArgs): Promise<UserSettings> => {
    const settings = userSettingsSchema.parse(await request.json())
    const user = await deps.ensureUser()
    await updateSettings(deps.userProfileRepo, user.uid, settings)
    return settings
  }
}
