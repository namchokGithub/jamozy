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
import { resolveHomeResume } from '../../domain/home/home-session'
import { defaultUserProfile, normalizeUserSettings, type UserSettings } from '../../domain/models/user-profile'

export interface CourseListPageData {
  courses: Course[]
  dueReviewCount: number
  displayName: string
  isAuthenticated: boolean
}

export interface CourseListLoaderData {
  // None of these are awaited: the page renders as soon as the user is known
  // and each part streams in behind its own placeholder, so the Home player
  // never waits on Firestore.
  // Account details, review count, and the Learning Path course list.
  page: Promise<CourseListPageData>
  // The static Home course (DEC-043), or null when none is deployed.
  homePlayer: Promise<HomePlayerData | null>
  // Live Progress of Home lessons, read in the background; null without
  // Home content or when it cannot be read (the cached Progress stays).
  homeProgress: Promise<Progress[] | null>
  // The Learning Path player, used only when there is no Home content.
  onePageLearningPath: Promise<OnePageLearningPath | null>
  settings: Promise<UserSettings>
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
    // Warms the typing renderer for the lesson Home opens with.
    prefetchTargets?: (targetTexts: string[]) => void
  }
  ensureUser: () => Promise<{ uid: string }>
  getSession?: () => Promise<{ kind: string }>
}) {
  return async (args?: LoaderFunctionArgs): Promise<CourseListLoaderData> => {
    // home.json does not depend on the user, so its request starts first.
    const homeContent = deps.home?.contentRepo.getHomeContent()
    const user = await deps.ensureUser()
    const params = args ? new URL(args.request.url).searchParams : null
    const afterLesson = params?.get('afterLesson')
    const afterExercise = params?.get('afterExercise')
    const after = afterLesson && afterExercise ? { lessonId: afterLesson, exerciseId: afterExercise } : undefined
    const coursesRequest = getCourses(deps.courseRepo)
    const profileRequest = deps.userProfileRepo?.getUserProfile(user.uid) ?? Promise.resolve(null)
    const settings = profileRequest.then((profile) =>
      normalizeUserSettings(profile?.settings ?? defaultUserProfile(user.uid, new Date()).settings),
    )
    const homePlayer = deps.home && homeContent
      ? getHomePlayer({ ...deps.home, contentRepo: { getHomeContent: () => homeContent } }, user.uid)
      : Promise.resolve(null)
    void homePlayer.then((player) => {
      if (!player || !deps.home?.prefetchTargets) return
      const opening = resolveHomeResume(player.content.units, player.resume)
      const lesson = player.content.units
        .flatMap(({ lessons }) => lessons)
        .find(({ id }) => id === opening?.lessonId)
      if (lesson) deps.home.prefetchTargets(lesson.exercises.map(({ targetText }) => targetText))
    })
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
    const page = Promise.all([
      coursesRequest,
      getDueReviewItems(deps.reviewRepo, user.uid),
      profileRequest,
      deps.getSession?.(),
    ]).then(([courses, items, profile, session]) => ({
      courses,
      dueReviewCount: items.length,
      displayName: profile?.displayName ?? 'Guest',
      isAuthenticated: session?.kind === 'authenticated',
    }))
    return { page, homePlayer, homeProgress, onePageLearningPath, settings }
  }
}
