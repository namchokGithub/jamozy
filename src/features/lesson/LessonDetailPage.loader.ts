import type { LoaderFunctionArgs } from 'react-router'
import { getLesson } from '../../application/get-lesson'
import type { LessonRepository } from '../../domain/repositories/lesson-repository'
import type { Lesson } from '../../domain/models/lesson'

export interface LessonDetailLoaderData {
  lesson: Lesson
}

export function createLessonDetailLoader(deps: { lessonRepo: LessonRepository }) {
  return async ({ params }: LoaderFunctionArgs): Promise<LessonDetailLoaderData> => {
    const lessonId = params.lessonId
    if (!lessonId) {
      throw new Error('Lesson id is required')
    }
    const lesson = await getLesson(deps.lessonRepo, lessonId)
    if (!lesson) {
      throw new Error(`Lesson not found: ${lessonId}`)
    }
    return { lesson }
  }
}
