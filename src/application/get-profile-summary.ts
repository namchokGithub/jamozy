import type { UserProfileRepository } from '../domain/repositories/user-profile-repository'
import {
  defaultUserProfile,
  levelFromExp,
  type UserStats,
} from '../domain/models/user-profile'

export interface ProfileSummary {
  exp: number
  level: number
  stats: UserStats
}

export async function getProfileSummary(
  userProfileRepo: UserProfileRepository,
  userId: string,
  now: Date = new Date(),
): Promise<ProfileSummary> {
  const profile = await userProfileRepo.getUserProfile(userId)
  const resolved = profile ?? defaultUserProfile(userId, now)
  return {
    exp: resolved.exp,
    level: levelFromExp(resolved.exp),
    stats: resolved.stats,
  }
}
