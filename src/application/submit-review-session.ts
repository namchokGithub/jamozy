import type { ReviewRepository } from '../domain/repositories/review-repository'
import { submitReviewResult } from './submit-review-result'

export interface SubmitReviewSessionResult {
  itemId: string
  wasCorrect: boolean
}

export interface SubmitReviewSessionOutcome {
  correctCount: number
  needsPracticeCount: number
}

export async function submitReviewSession(
  reviewRepo: ReviewRepository,
  userId: string,
  results: SubmitReviewSessionResult[],
  now: Date = new Date(),
): Promise<SubmitReviewSessionOutcome> {
  let correctCount = 0
  let needsPracticeCount = 0

  for (const { itemId, wasCorrect } of results) {
    const item = await reviewRepo.getReviewItem(userId, itemId)
    if (!item) continue

    await submitReviewResult(reviewRepo, userId, item, wasCorrect, now)
    if (wasCorrect) {
      correctCount += 1
    } else {
      needsPracticeCount += 1
    }
  }

  return { correctCount, needsPracticeCount }
}
