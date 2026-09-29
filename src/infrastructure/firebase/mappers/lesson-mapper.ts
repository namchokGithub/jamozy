import type { DocumentData } from 'firebase/firestore'
import type { Lesson, LessonExercise } from '../../../domain/models/lesson'
import type {
  ContentStatus,
  RestorableContentStatus,
} from '../../../domain/models/content-status'

export function toLesson(id: string, data: DocumentData): Lesson {
  return {
    id,
    unitId: data.unitId,
    title: data.title,
    type: data.type,
    order: data.order,
    exercises: (data.exercises as LessonExercise[]) ?? [],
    createdAt: data.createdAt.toDate(),
    updatedAt: data.updatedAt.toDate(),
    status: (data.status as ContentStatus | undefined) ?? 'draft',
    ...(data.archivedFromStatus
      ? {
          archivedFromStatus:
            data.archivedFromStatus as RestorableContentStatus,
        }
      : {}),
  }
}
