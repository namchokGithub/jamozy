import { getCourses } from '../../application/get-course'
import type { CourseRepository } from '../../domain/repositories/course-repository'
import type { Course } from '../../domain/models/course'

export interface CourseListLoaderData {
  courses: Course[]
}

export function createCourseListLoader(deps: {
  courseRepo: CourseRepository
  ensureUser: () => Promise<{ uid: string }>
}) {
  return async (): Promise<CourseListLoaderData> => {
    await deps.ensureUser()
    const courses = await getCourses(deps.courseRepo)
    return { courses }
  }
}
