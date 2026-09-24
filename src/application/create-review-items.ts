import type { ReviewRepository } from '../domain/repositories/review-repository'
import { nextReviewDate } from '../domain/models/review-item'
import type { ReviewItem } from '../domain/models/review-item'
import type { MistakeReport } from '../domain/korean/lesson-session'

export async function createReviewItemsFromMistakes(
  reviewRepo: ReviewRepository,
  userId: string,
  lessonId: string,
  mistakes: MistakeReport[],
  now: Date = new Date(),
): Promise<void> {
  for (const mistake of mistakes) {
    const existing = await reviewRepo.getReviewItem(userId, mistake.sourceExerciseId)

    if (existing) {
      const updated: ReviewItem = {
        ...existing,
        mistakeCount: existing.mistakeCount + 1,
        lastMistakeAt: now,
        resolved: false,
        box: 1,
        nextReviewAt: nextReviewDate(1, now),
      }
      await reviewRepo.updateReviewItem(userId, updated)
      continue
    }

    const created: ReviewItem = {
      id: mistake.sourceExerciseId,
      sourceLessonId: lessonId,
      sourceExerciseId: mistake.sourceExerciseId,
      targetText: mistake.targetText,
      reason: 'mistake',
      mistakeCount: 1,
      lastMistakeAt: now,
      resolved: false,
      box: 1,
      nextReviewAt: nextReviewDate(1, now),
    }
    await reviewRepo.addReviewItem(userId, created)
  }
}
