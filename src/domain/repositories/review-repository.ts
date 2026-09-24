import type { ReviewItem } from '../models/review-item'

export interface ReviewRepository {
  getReviewItems(userId: string): Promise<ReviewItem[]>
  getReviewItem(userId: string, itemId: string): Promise<ReviewItem | null>
  addReviewItem(userId: string, item: ReviewItem): Promise<void>
  updateReviewItem(userId: string, item: ReviewItem): Promise<void>
}
