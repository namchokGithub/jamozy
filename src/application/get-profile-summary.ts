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
  const hasLegacyBaseline = resolved.exp > 0 || Object.values(resolved.stats).some((value) => value > 0)
  const sessionAttempts = sessionAggregate.acceptedKeystrokes + sessionAggregate.rejectedKeystrokes
  const sessionAccuracy = sessionAttempts === 0 ? 0 : (sessionAggregate.acceptedKeystrokes / sessionAttempts) * 100
  const sessionWpm = sessionAggregate.totalTypingTimeSeconds === 0 ? 0 : (sessionAggregate.acceptedKeystrokes / 5) / (sessionAggregate.totalTypingTimeSeconds / 60)
  return {
    exp: resolved.exp + sessionAggregate.exp,
    level: levelFromExp(resolved.exp + sessionAggregate.exp),
    stats: {
      ...resolved.stats,
      wordsPracticed: resolved.stats.wordsPracticed + sessionAggregate.exercisesAttempted,
      averageAccuracy: hasLegacyBaseline || sessionAttempts === 0 ? resolved.stats.averageAccuracy : sessionAccuracy,
      bestAccuracy: Math.max(resolved.stats.bestAccuracy, sessionAggregate.bestAccuracy),
      averageSpeedWpm: hasLegacyBaseline || sessionAggregate.totalTypingTimeSeconds === 0 ? resolved.stats.averageSpeedWpm : sessionWpm,
      totalTypingTimeSeconds: resolved.stats.totalTypingTimeSeconds + sessionAggregate.totalTypingTimeSeconds,
    },
    sessionAggregate,
  }
}
