import { getDueReviewItems } from '../../application/get-review-items'
import { getReviewPreviews } from '../../application/get-review-previews'
import { getSettings } from '../../application/get-settings'
import {
  getJamoOverview,
  type JamoOverview,
} from '../../application/get-weak-jamo-practice'
import type { HomeContentRepository } from '../../domain/repositories/home-content-repository'
import type { JamoStatsRepository } from '../../domain/repositories/jamo-stats-repository'
import type { ReviewRepository } from '../../domain/repositories/review-repository'
import type { LessonRepository } from '../../domain/repositories/lesson-repository'
import type { UserProfileRepository } from '../../domain/repositories/user-profile-repository'
import type { ReviewPreview } from '../../application/get-review-previews'
import type { UserSettings } from '../../domain/models/user-profile'

export interface ReviewLoaderData {
  previews: ReviewPreview[]
  settings: UserSettings
  // Per-jamo grid and Weak Jamo practice entry (DEC-051); null hides both.
  jamoOverview: JamoOverview | null
}

export function createReviewLoader(deps: {
  reviewRepo: ReviewRepository
  lessonRepo: LessonRepository
  userProfileRepo: UserProfileRepository
  jamoStatsRepo?: JamoStatsRepository
  contentRepo?: HomeContentRepository
  ensureUser: () => Promise<{ uid: string }>
}) {
  return async (): Promise<ReviewLoaderData> => {
    const user = await deps.ensureUser()
    const { jamoStatsRepo, contentRepo } = deps
    const [items, settings, jamoOverview] = await Promise.all([
      getDueReviewItems(deps.reviewRepo, user.uid, new Date(), 20),
      getSettings(deps.userProfileRepo, user.uid),
      jamoStatsRepo && contentRepo
        ? getJamoOverview({ jamoStatsRepo, contentRepo }, user.uid)
        : null,
    ])
    const previews = await getReviewPreviews(deps.lessonRepo, items)
    return { previews, settings, jamoOverview }
  }
}
