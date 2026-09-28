import { getCourses } from '../../application/get-course'
import { getDueReviewItems } from '../../application/get-review-items'
import type { CourseRepository } from '../../domain/repositories/course-repository'
import type { ReviewRepository } from '../../domain/repositories/review-repository'
import type { Course } from '../../domain/models/course'
import type { UserProfileRepository } from '../../domain/repositories/user-profile-repository'

export interface CourseListLoaderData {
  courses: Course[]
  dueReviewCount: number
  displayName: string
}

export function createCourseListLoader(deps: {
  courseRepo: CourseRepository
  reviewRepo: ReviewRepository
  userProfileRepo?: UserProfileRepository
  ensureUser: () => Promise<{ uid: string }>
}) {
  return async (): Promise<CourseListLoaderData> => {
    const user = await deps.ensureUser()
    const [courses, items, profile] = await Promise.all([getCourses(deps.courseRepo), getDueReviewItems(deps.reviewRepo, user.uid), deps.userProfileRepo?.getUserProfile(user.uid) ?? null])
    return { courses, dueReviewCount: items.length, displayName: profile?.displayName ?? 'Guest' }
  }
}
