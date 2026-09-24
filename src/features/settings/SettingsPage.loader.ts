import { getSettings } from '../../application/get-settings'
import type { UserProfileRepository } from '../../domain/repositories/user-profile-repository'
import type { UserSettings } from '../../domain/models/user-profile'

export interface SettingsLoaderData {
  settings: UserSettings
}

export function createSettingsLoader(deps: {
  userProfileRepo: UserProfileRepository
  ensureUser: () => Promise<{ uid: string }>
}) {
  return async (): Promise<SettingsLoaderData> => {
    const user = await deps.ensureUser()
    const settings = await getSettings(deps.userProfileRepo, user.uid)
    return { settings }
  }
}
