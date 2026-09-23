import { getCourses } from '../../application/get-course'
import type { CourseRepository } from '../../domain/repositories/course-repository'
import type { Course } from '../../domain/models/course'

export interface CourseListLoaderData {
  courses: Course[]
}

export function createCourseListLoader(deps: { courseRepo: CourseRepository }) {
  return async (): Promise<CourseListLoaderData> => {
    const courses = await getCourses(deps.courseRepo)
    return { courses }
  }
}
