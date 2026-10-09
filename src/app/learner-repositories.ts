import type { ProgressRepository } from '../domain/repositories/progress-repository'
import type { ReviewRepository } from '../domain/repositories/review-repository'
import type { UserProfileRepository } from '../domain/repositories/user-profile-repository'
import type { UserSessionRepository } from '../domain/repositories/user-session-repository'
import type { SessionSubmissionRepository } from '../domain/repositories/session-submission-repository'
import type { JamoStatsRepository } from '../domain/repositories/jamo-stats-repository'

export function createLearnerRepositories(deps: {
  sessions: UserSessionRepository
  guest: { progressRepo: ProgressRepository; reviewRepo: ReviewRepository; userProfileRepo: UserProfileRepository; sessionSubmissionRepo: SessionSubmissionRepository; jamoStatsRepo: JamoStatsRepository }
  authenticated: { progressRepo: ProgressRepository; reviewRepo: ReviewRepository; userProfileRepo: UserProfileRepository; sessionSubmissionRepo: SessionSubmissionRepository; jamoStatsRepo: JamoStatsRepository }
}) {
  const active = async () => deps.sessions.getActiveSession()
  const choose = async <T>(guest: T, authenticated: T) => (await active()).kind === 'guest' ? guest : authenticated
  const user = async () => ({ uid: (await active()).userId })
  return {
    getActiveUser: user,
    progressRepo: { getProgress: async (u: string, l: string) => (await choose(deps.guest.progressRepo, deps.authenticated.progressRepo)).getProgress(u, l), getAllProgress: async (u: string) => (await choose(deps.guest.progressRepo, deps.authenticated.progressRepo)).getAllProgress(u), saveProgress: async (u: string, p: Parameters<ProgressRepository['saveProgress']>[1]) => (await choose(deps.guest.progressRepo, deps.authenticated.progressRepo)).saveProgress(u, p) } satisfies ProgressRepository,
    reviewRepo: { getReviewItems: async (u: string) => (await choose(deps.guest.reviewRepo, deps.authenticated.reviewRepo)).getReviewItems(u), getReviewItem: async (u: string, i: string) => (await choose(deps.guest.reviewRepo, deps.authenticated.reviewRepo)).getReviewItem(u, i), addReviewItem: async (u: string, i: Parameters<ReviewRepository['addReviewItem']>[1]) => (await choose(deps.guest.reviewRepo, deps.authenticated.reviewRepo)).addReviewItem(u, i), updateReviewItem: async (u: string, i: Parameters<ReviewRepository['updateReviewItem']>[1]) => (await choose(deps.guest.reviewRepo, deps.authenticated.reviewRepo)).updateReviewItem(u, i) } satisfies ReviewRepository,
    userProfileRepo: { getUserProfile: async (u: string) => (await choose(deps.guest.userProfileRepo, deps.authenticated.userProfileRepo)).getUserProfile(u), saveUserProfile: async (u: string, p: Parameters<UserProfileRepository['saveUserProfile']>[1]) => (await choose(deps.guest.userProfileRepo, deps.authenticated.userProfileRepo)).saveUserProfile(u, p) } satisfies UserProfileRepository,
    sessionSubmissionRepo: { submit: async (u: string, s: Parameters<SessionSubmissionRepository['submit']>[1], e: Parameters<SessionSubmissionRepository['submit']>[2]) => (await choose(deps.guest.sessionSubmissionRepo, deps.authenticated.sessionSubmissionRepo)).submit(u, s, e) } satisfies SessionSubmissionRepository,
    jamoStatsRepo: { getJamoStats: async (u: string) => (await choose(deps.guest.jamoStatsRepo, deps.authenticated.jamoStatsRepo)).getJamoStats(u) } satisfies JamoStatsRepository,
  }
}
