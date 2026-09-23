import type { LoaderFunctionArgs } from 'react-router'
import { getCourseMap, type CourseMap } from '../../application/get-course'
import type { CourseRepository } from '../../domain/repositories/course-repository'
import type { LessonRepository } from '../../domain/repositories/lesson-repository'
import type { ProgressRepository } from '../../domain/repositories/progress-repository'
import { signInAnonymouslyIfNeeded } from '../../infrastructure/firebase/firebase'

export interface CourseMapLoaderData {
  courseMap: CourseMap
}

export function createCourseMapLoader(deps: {
  courseRepo: CourseRepository
  lessonRepo: LessonRepository
  progressRepo: ProgressRepository
}) {
  return async ({ params }: LoaderFunctionArgs): Promise<CourseMapLoaderData> => {
    const courseId = params.courseId
    if (!courseId) {
      throw new Error('Course id is required')
    }
    const user = await signInAnonymouslyIfNeeded()
    const courseMap = await getCourseMap(deps, user.uid, courseId)
    return { courseMap }
  }
}
