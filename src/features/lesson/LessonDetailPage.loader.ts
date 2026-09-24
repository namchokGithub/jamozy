import type { LoaderFunctionArgs } from 'react-router'
import { getLesson } from '../../application/get-lesson'
import { getSettings } from '../../application/get-settings'
import type { LessonRepository } from '../../domain/repositories/lesson-repository'
import type { UserProfileRepository } from '../../domain/repositories/user-profile-repository'
import type { Lesson } from '../../domain/models/lesson'
import type { UserSettings } from '../../domain/models/user-profile'
import { NotFoundError } from '../../domain/errors'

export interface LessonDetailLoaderData {
  lesson: Lesson
  settings: UserSettings
}

export function createLessonDetailLoader(deps: {
  lessonRepo: LessonRepository
  userProfileRepo: UserProfileRepository
  ensureUser: () => Promise<{ uid: string }>
}) {
  return async ({ params }: LoaderFunctionArgs): Promise<LessonDetailLoaderData> => {
    const lessonId = params.lessonId
    if (!lessonId) {
      throw new Error('Lesson id is required')
    }
    const user = await deps.ensureUser()
    const [lesson, settings] = await Promise.all([
      getLesson(deps.lessonRepo, lessonId),
      getSettings(deps.userProfileRepo, user.uid),
    ])
    if (!lesson) {
      throw new NotFoundError(`Lesson not found: ${lessonId}`)
    }
    return { lesson, settings }
  }
}
