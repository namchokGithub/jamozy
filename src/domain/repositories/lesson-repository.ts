import type { Lesson } from '../models/lesson'

export interface LessonRepository {
  getLessonsByUnitId(unitId: string): Promise<Lesson[]>
  getLessonById(lessonId: string): Promise<Lesson | null>
}
