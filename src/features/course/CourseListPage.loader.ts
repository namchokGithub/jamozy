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
import { getHomePlayer, refreshHomeProgress, type HomePlayerData } from '../../application/get-home-player'
import type { HomeContentRepository } from '../../domain/repositories/home-content-repository'
import type { HomeLocalStateRepository } from '../../domain/repositories/home-local-state-repository'
import type { Progress } from '../../domain/models/progress'

export interface CourseListLoaderData {
  courses: Course[]
  dueReviewCount: number
  displayName: string
  isAuthenticated: boolean
  // None of these are awaited: the page renders first and each part streams
  // in behind its own skeleton.
  // The static Home course (DEC-043), or null when none is deployed.
  homePlayer: Promise<HomePlayerData | null>
  // Live Progress of Home lessons, read in the background; null without
  // Home content or when it cannot be read (the cached Progress stays).
  homeProgress: Promise<Progress[] | null>
  // The Learning Path player, used only when there is no Home content.
  onePageLearningPath: Promise<OnePageLearningPath | null>
}

export function createCourseListLoader(deps: {
  courseRepo: CourseRepository
  reviewRepo: ReviewRepository
  userProfileRepo?: UserProfileRepository
  lessonRepo?: LessonRepository
  progressRepo?: ProgressRepository
  checkpointRepo?: OnePageLearningCheckpointRepository
  home?: {
    contentRepo: HomeContentRepository
    localState: HomeLocalStateRepository
    pendingExerciseIds: (userId: string) => Promise<Map<string, Set<string>>>
  }
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
    const homePlayer = deps.home
      ? getHomePlayer(deps.home, user.uid)
      : Promise.resolve(null)
    const homeProgress = homePlayer.then((player) =>
      player && deps.home && deps.progressRepo
        ? refreshHomeProgress({ progressRepo: deps.progressRepo, localState: deps.home.localState }, user.uid, player.content).catch(() => null)
        : null,
    )
    const onePageLearningPath = homePlayer.then((player) =>
      !player && deps.lessonRepo && deps.progressRepo && deps.checkpointRepo
        ? getOnePageLearningPath({
          courseRepo: deps.courseRepo,
          lessonRepo: deps.lessonRepo,
          progressRepo: deps.progressRepo,
          checkpointRepo: deps.checkpointRepo,
          courses: coursesRequest,
          }, user.uid, params?.get('course') ?? undefined, after)
        : null,
    )
    const [courses, items, profile, session] = await Promise.all([
      coursesRequest,
      getDueReviewItems(deps.reviewRepo, user.uid),
      deps.userProfileRepo?.getUserProfile(user.uid) ?? null,
      deps.getSession?.(),
    ])
    return { courses, dueReviewCount: items.length, displayName: profile?.displayName ?? 'Guest', isAuthenticated: session?.kind === 'authenticated', homePlayer, homeProgress, onePageLearningPath }
  }
}
