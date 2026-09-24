import type { UserProfileRepository } from '../domain/repositories/user-profile-repository'
import { defaultUserProfile, type UserSettings } from '../domain/models/user-profile'

export async function updateSettings(
  userProfileRepo: UserProfileRepository,
  userId: string,
  settings: UserSettings,
  now: Date = new Date(),
): Promise<void> {
  const existing = await userProfileRepo.getUserProfile(userId)
  const profile = existing
    ? { ...existing, settings }
    : { ...defaultUserProfile(userId, now), settings }
  await userProfileRepo.saveUserProfile(userId, profile)
}
