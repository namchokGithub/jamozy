import type { LessonExercise } from '../domain/models/lesson'
import type { ReviewItem } from '../domain/models/review-item'
import type { LessonRepository } from '../domain/repositories/lesson-repository'

export interface ReviewPreview {
  item: ReviewItem
  exercise: LessonExercise | null
}

export async function getReviewPreviews(
  lessonRepo: LessonRepository,
  items: ReviewItem[],
): Promise<ReviewPreview[]> {
  const lessonIds = [...new Set(items.map((item) => item.sourceLessonId))]
  const lessons = await Promise.all(
    lessonIds.map(async (lessonId) => [lessonId, await lessonRepo.getLessonById(lessonId)] as const),
  )
  const lessonsById = new Map(lessons)

  return items.map((item) => {
    const exercise = lessonsById
      .get(item.sourceLessonId)
      ?.exercises.find((candidate) => candidate.id === item.sourceExerciseId)

    return {
      item,
      exercise: exercise?.targetText === item.targetText ? exercise : null,
    }
  })
}
