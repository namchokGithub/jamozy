import type { UserProfileRepository } from '../domain/repositories/user-profile-repository'
import { defaultUserProfile, type UserSettings } from '../domain/models/user-profile'

export async function getSettings(
  userProfileRepo: UserProfileRepository,
  userId: string,
  now: Date = new Date(),
): Promise<UserSettings> {
  const profile = await userProfileRepo.getUserProfile(userId)
  return profile?.settings ?? defaultUserProfile(userId, now).settings
}
