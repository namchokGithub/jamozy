import { getDueReviewItems } from '../../application/get-review-items'
import { getReviewPreviews } from '../../application/get-review-previews'
import { getSettings } from '../../application/get-settings'
import type { ReviewRepository } from '../../domain/repositories/review-repository'
import type { LessonRepository } from '../../domain/repositories/lesson-repository'
import type { UserProfileRepository } from '../../domain/repositories/user-profile-repository'
import type { ReviewPreview } from '../../application/get-review-previews'
import type { UserSettings } from '../../domain/models/user-profile'

export interface ReviewLoaderData {
  previews: ReviewPreview[]
  settings: UserSettings
}

export function createReviewLoader(deps: {
  reviewRepo: ReviewRepository
  lessonRepo: LessonRepository
  userProfileRepo: UserProfileRepository
  ensureUser: () => Promise<{ uid: string }>
}) {
  return async (): Promise<ReviewLoaderData> => {
    const user = await deps.ensureUser()
    const [items, settings] = await Promise.all([
      getDueReviewItems(deps.reviewRepo, user.uid, new Date(), 20),
      getSettings(deps.userProfileRepo, user.uid),
    ])
    const previews = await getReviewPreviews(deps.lessonRepo, items)
    return { previews, settings }
  }
}
