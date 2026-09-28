import type { UserProfileRepository } from '../domain/repositories/user-profile-repository'
import {
  defaultUserProfile,
  levelFromExp,
  type UserStats,
} from '../domain/models/user-profile'
import { emptySessionAggregate, type SessionAggregate } from '../domain/models/session-aggregate'

export interface ProfileSummary {
  exp: number
  level: number
  stats: UserStats
  sessionAggregate: SessionAggregate
}

export async function getProfileSummary(
  userProfileRepo: UserProfileRepository,
  userId: string,
  now: Date = new Date(),
): Promise<ProfileSummary> {
  const profile = await userProfileRepo.getUserProfile(userId)
  const resolved = profile ?? defaultUserProfile(userId, now)
  const sessionAggregate = resolved.sessionAggregate ?? emptySessionAggregate()
  return {
    exp: resolved.exp + sessionAggregate.exp,
    level: levelFromExp(resolved.exp + sessionAggregate.exp),
    stats: {
      ...resolved.stats,
      wordsPracticed: resolved.stats.wordsPracticed + sessionAggregate.exercisesAttempted,
      bestAccuracy: Math.max(resolved.stats.bestAccuracy, sessionAggregate.bestAccuracy),
      totalTypingTimeSeconds: resolved.stats.totalTypingTimeSeconds + sessionAggregate.totalTypingTimeSeconds,
    },
    sessionAggregate,
  }
}
