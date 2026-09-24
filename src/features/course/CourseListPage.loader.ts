import { getCourses } from '../../application/get-course'
import { getDueReviewItems } from '../../application/get-review-items'
import type { CourseRepository } from '../../domain/repositories/course-repository'
import type { ReviewRepository } from '../../domain/repositories/review-repository'
import type { Course } from '../../domain/models/course'

export interface CourseListLoaderData {
  courses: Course[]
  dueReviewCount: number
}

export function createCourseListLoader(deps: {
  courseRepo: CourseRepository
  reviewRepo: ReviewRepository
  ensureUser: () => Promise<{ uid: string }>
}) {
  return async (): Promise<CourseListLoaderData> => {
    const user = await deps.ensureUser()
    const courses = await getCourses(deps.courseRepo)
    const dueReviewCount = (await getDueReviewItems(deps.reviewRepo, user.uid)).length
    return { courses, dueReviewCount }
  }
}
