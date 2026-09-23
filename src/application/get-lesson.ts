import type { LessonRepository } from '../domain/repositories/lesson-repository'
import type { Lesson } from '../domain/models/lesson'

export function getLessonsByUnit(
  lessonRepo: LessonRepository,
  unitId: string,
): Promise<Lesson[]> {
  return lessonRepo.getLessonsByUnitId(unitId)
}

export function getLesson(
  lessonRepo: LessonRepository,
  lessonId: string,
): Promise<Lesson | null> {
  return lessonRepo.getLessonById(lessonId)
}
