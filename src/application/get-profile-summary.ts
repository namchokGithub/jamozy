import type { UserProfileRepository } from '../domain/repositories/user-profile-repository'
import {
  defaultUserProfile,
  levelProgress,
  progressionOf,
  type UserStats,
} from '../domain/models/user-profile'
import {
  emptySessionAggregate,
  type SessionAggregate,
} from '../domain/models/session-aggregate'

export interface ProfileSummary {
  exp: number
  currentExp?: number
  rebirthCount?: number
  perkPointsEarned?: number
  level: number
  expIntoLevel: number
  expToNextLevel: number
  stats: UserStats
  sessionAggregate: SessionAggregate
}

export async function getProfileSummary(
  userProfileRepo: UserProfileRepository,
  userId: string,
  now: Date = new Date(),
): Promise<ProfileSummary> {
  const profile = await userProfileRepo.getUserProfile(userId)
  const fallback = defaultUserProfile(userId, now)
  // Guest profiles skip the Firestore mapper, so guard missing stats here too.
  const resolved = profile
    ? { ...profile, stats: profile.stats ?? fallback.stats }
    : fallback
  const sessionAggregate = resolved.sessionAggregate ?? emptySessionAggregate()
  const progression = progressionOf(resolved)
  const exp = progression.totalExpEarned
  const hasLegacyBaseline =
    resolved.exp > 0 || Object.values(resolved.stats).some((value) => value > 0)
  const sessionAttempts =
    sessionAggregate.acceptedKeystrokes + sessionAggregate.rejectedKeystrokes
  const sessionAccuracy =
    sessionAttempts === 0
      ? 0
      : (sessionAggregate.acceptedKeystrokes / sessionAttempts) * 100
  const sessionTypingSeconds =
    sessionAggregate.typingSeconds ?? sessionAggregate.totalTypingTimeSeconds
  const sessionWpm =
    sessionTypingSeconds === 0
      ? 0
      : sessionAggregate.acceptedKeystrokes / 5 / (sessionTypingSeconds / 60)
  return {
    exp,
    currentExp: progression.currentExp,
    rebirthCount: progression.rebirthCount,
    perkPointsEarned: progression.perkPointsEarned,
    ...levelProgress(progression.currentExp, progression.rebirthCount),
    stats: {
      ...resolved.stats,
      wordsPracticed:
        resolved.stats.wordsPracticed + sessionAggregate.exercisesAttempted,
      averageAccuracy:
        hasLegacyBaseline || sessionAttempts === 0
          ? resolved.stats.averageAccuracy
          : sessionAccuracy,
      bestAccuracy: Math.max(
        resolved.stats.bestAccuracy,
        sessionAggregate.bestAccuracy,
      ),
      averageSpeedWpm:
        resolved.stats.averageSpeedWpm > 0 || sessionTypingSeconds === 0
          ? resolved.stats.averageSpeedWpm
          : sessionWpm,
      totalTypingTimeSeconds:
        resolved.stats.totalTypingTimeSeconds +
        sessionAggregate.totalTypingTimeSeconds,
    },
    sessionAggregate,
  }
}
