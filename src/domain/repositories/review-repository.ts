import type { ReviewItem } from '../models/review-item'

export interface ReviewRepository {
  getReviewItems(userId: string): Promise<ReviewItem[]>
  addReviewItem(userId: string, item: ReviewItem): Promise<void>
  markResolved(userId: string, itemId: string): Promise<void>
}
