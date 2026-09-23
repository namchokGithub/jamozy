import type { LoaderFunctionArgs } from 'react-router'
import { getCourseMap, type CourseMap } from '../../application/get-course'
import type { CourseRepository } from '../../domain/repositories/course-repository'
import type { LessonRepository } from '../../domain/repositories/lesson-repository'
import type { ProgressRepository } from '../../domain/repositories/progress-repository'

export interface CourseMapLoaderData {
  courseMap: CourseMap
}

export function createCourseMapLoader(deps: {
  courseRepo: CourseRepository
  lessonRepo: LessonRepository
  progressRepo: ProgressRepository
  ensureUser: () => Promise<{ uid: string }>
}) {
  return async ({ params }: LoaderFunctionArgs): Promise<CourseMapLoaderData> => {
    const courseId = params.courseId
    if (!courseId) {
      throw new Error('Course id is required')
    }
    const user = await deps.ensureUser()
    const courseMap = await getCourseMap(deps, user.uid, courseId)
    return { courseMap }
  }
}
