import { completeLesson, type CompleteLessonDeps, type CompleteLessonOutcome } from './complete-lesson'
import { createReviewItemsFromMistakes } from './create-review-items'
import type { ReviewRepository } from '../domain/repositories/review-repository'
import type { LessonResult } from '../domain/korean/lesson-session'

export interface CompleteLessonSessionDeps extends CompleteLessonDeps {
  reviewRepo: ReviewRepository
}

export async function completeLessonSession(
  deps: CompleteLessonSessionDeps,
  userId: string,
  lessonId: string,
  result: LessonResult,
  now: Date = new Date(),
): Promise<CompleteLessonOutcome> {
  const outcome = await completeLesson(deps, userId, lessonId, result, now)
  await createReviewItemsFromMistakes(deps.reviewRepo, userId, lessonId, result.mistakes, now)
  return outcome
}
