import { getDueReviewItems } from '../../application/get-review-items'
import type { ReviewRepository } from '../../domain/repositories/review-repository'
import type { ReviewItem } from '../../domain/models/review-item'

export interface ReviewLoaderData {
  items: ReviewItem[]
}

export function createReviewLoader(deps: {
  reviewRepo: ReviewRepository
  ensureUser: () => Promise<{ uid: string }>
}) {
  return async (): Promise<ReviewLoaderData> => {
    const user = await deps.ensureUser()
    const items = await getDueReviewItems(deps.reviewRepo, user.uid, new Date(), 20)
    return { items }
  }
}
