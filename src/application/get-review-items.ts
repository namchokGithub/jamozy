import type { ReviewRepository } from '../domain/repositories/review-repository'
import type { ReviewItem } from '../domain/models/review-item'

export async function getDueReviewItems(
  reviewRepo: ReviewRepository,
  userId: string,
  now: Date = new Date(),
  limit: number = Infinity,
): Promise<ReviewItem[]> {
  const items = await reviewRepo.getReviewItems(userId)
  return items.filter((item) => !item.resolved && item.nextReviewAt <= now).slice(0, limit)
}
