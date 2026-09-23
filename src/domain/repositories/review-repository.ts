import type { ReviewItem } from '../models/review-item'

export interface ReviewRepository {
  getReviewItems(userId: string): Promise<ReviewItem[]>
  addReviewItem(userId: string, item: ReviewItem): Promise<void>
  updateReviewItem(userId: string, item: ReviewItem): Promise<void>
}
