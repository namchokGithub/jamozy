import type { LoaderFunctionArgs } from 'react-router'
import { getLesson } from '../../application/get-lesson'
import type { LessonRepository } from '../../domain/repositories/lesson-repository'
import type { Lesson } from '../../domain/models/lesson'
import { NotFoundError } from '../../domain/errors'

export interface LessonDetailLoaderData {
  lesson: Lesson
}

export function createLessonDetailLoader(deps: {
  lessonRepo: LessonRepository
  ensureUser: () => Promise<{ uid: string }>
}) {
  return async ({ params }: LoaderFunctionArgs): Promise<LessonDetailLoaderData> => {
    const lessonId = params.lessonId
    if (!lessonId) {
      throw new Error('Lesson id is required')
    }
    await deps.ensureUser()
    const lesson = await getLesson(deps.lessonRepo, lessonId)
    if (!lesson) {
      throw new NotFoundError(`Lesson not found: ${lessonId}`)
    }
    return { lesson }
  }
}
