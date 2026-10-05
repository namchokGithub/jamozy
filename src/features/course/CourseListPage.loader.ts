import { getCourses } from '../../application/get-course'
import { getDueReviewItems } from '../../application/get-review-items'
import type { CourseRepository } from '../../domain/repositories/course-repository'
import type { ReviewRepository } from '../../domain/repositories/review-repository'
import type { Course } from '../../domain/models/course'
import type { UserProfileRepository } from '../../domain/repositories/user-profile-repository'
import type { ProgressRepository } from '../../domain/repositories/progress-repository'
import type { LessonRepository } from '../../domain/repositories/lesson-repository'
import type { OnePageLearningCheckpointRepository } from '../../domain/repositories/one-page-learning-checkpoint-repository'
import type { LoaderFunctionArgs } from 'react-router'
import { getOnePageLearningPath, type OnePageLearningPath } from '../../application/get-one-page-learning-path'

export interface CourseListLoaderData {
  courses: Course[]
  dueReviewCount: number
  displayName: string
  isAuthenticated: boolean
  // Not awaited: the page renders without waiting for the Home player, which
  // streams in behind its own skeleton.
  onePageLearningPath: Promise<OnePageLearningPath | null>
}

export function createCourseListLoader(deps: {
  courseRepo: CourseRepository
  reviewRepo: ReviewRepository
  userProfileRepo?: UserProfileRepository
  lessonRepo?: LessonRepository
  progressRepo?: ProgressRepository
  checkpointRepo?: OnePageLearningCheckpointRepository
  ensureUser: () => Promise<{ uid: string }>
  getSession?: () => Promise<{ kind: string }>
}) {
  return async (args?: LoaderFunctionArgs): Promise<CourseListLoaderData> => {
    const user = await deps.ensureUser()
    const params = args ? new URL(args.request.url).searchParams : null
    const afterLesson = params?.get('afterLesson')
    const afterExercise = params?.get('afterExercise')
    const after = afterLesson && afterExercise ? { lessonId: afterLesson, exerciseId: afterExercise } : undefined
    const coursesRequest = getCourses(deps.courseRepo)
    const onePageLearningPath = deps.lessonRepo && deps.progressRepo && deps.checkpointRepo
      ? getOnePageLearningPath({
          courseRepo: deps.courseRepo,
          lessonRepo: deps.lessonRepo,
          progressRepo: deps.progressRepo,
          checkpointRepo: deps.checkpointRepo,
          courses: coursesRequest,
        }, user.uid, params?.get('course') ?? undefined, after)
      : Promise.resolve(null)
    const [courses, items, profile, session] = await Promise.all([
      coursesRequest,
      getDueReviewItems(deps.reviewRepo, user.uid),
      deps.userProfileRepo?.getUserProfile(user.uid) ?? null,
      deps.getSession?.(),
    ])
    return { courses, dueReviewCount: items.length, displayName: profile?.displayName ?? 'Guest', isAuthenticated: session?.kind === 'authenticated', onePageLearningPath }
  }
}
