import type { ReviewRepository } from '../domain/repositories/review-repository'
import {
  nextBox,
  nextReviewDate,
  type ReviewItem,
} from '../domain/models/review-item'

const MASTERED_BOX = 5

export async function submitReviewResult(
  reviewRepo: ReviewRepository,
  userId: string,
  item: ReviewItem,
  wasCorrect: boolean,
  now: Date = new Date(),
): Promise<ReviewItem> {
  const box = nextBox(item.box, wasCorrect)

  const updated: ReviewItem = {
    ...item,
    box,
    nextReviewAt: nextReviewDate(box, now),
    resolved: wasCorrect && box === MASTERED_BOX,
    mistakeCount: wasCorrect ? item.mistakeCount : item.mistakeCount + 1,
    lastMistakeAt: wasCorrect ? item.lastMistakeAt : now,
  }

  await reviewRepo.updateReviewItem(userId, updated)
  return updated
}
