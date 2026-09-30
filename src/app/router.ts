import { createBrowserRouter } from 'react-router'
import {
  courseRepo,
  lessonRepo,
  progressRepo as firebaseProgressRepo,
  userProfileRepo as firebaseUserProfileRepo,
  reviewRepo as firebaseReviewRepo,
} from '../infrastructure/firebase/repositories'
import { GuestSessionRepository } from '../infrastructure/local/guest-session-repository'
import {
  LocalProgressRepository,
  LocalReviewRepository,
  LocalUserProfileRepository,
} from '../infrastructure/local/local-repositories'
import { LocalSessionSubmissionRepository } from '../infrastructure/local/local-session-submission-repository'
import { FirebaseSessionSubmissionRepository } from '../infrastructure/firebase/repositories/firebase-session-submission-repository'
import { LocalGuestMigrationRepository } from '../infrastructure/local/local-guest-migration-repository'
import { LocalOnePageLearningCheckpointRepository } from '../infrastructure/local/local-one-page-learning-checkpoint-repository'
import { FirebaseAccountMigrationRepository } from '../infrastructure/firebase/repositories/firebase-account-migration-repository'
import { createLearnerRepositories } from './learner-repositories'
import { FirebaseAuthRepository } from '../infrastructure/firebase/firebase-auth-repository'
import { FirebaseAdminAuthRepository } from '../infrastructure/firebase/firebase-admin-auth-repository'
import { FirebaseAdminContentRepository } from '../infrastructure/firebase/repositories/firebase-admin-content-repository'
import { SessionManager } from '../application/session-manager'
import CourseListPage from '../features/course/CourseListPage'
import { createCourseListLoader } from '../features/course/CourseListPage.loader'
import { createCourseListAction } from '../features/course/CourseListPage.action'
import CourseMapPage from '../features/course/CourseMapPage'
import { createCourseMapLoader } from '../features/course/CourseMapPage.loader'
import LessonDetailPage from '../features/lesson/LessonDetailPage'
import { createLessonDetailLoader } from '../features/lesson/LessonDetailPage.loader'
import { createCompleteLessonSessionAction } from '../features/lesson/LessonDetailPage.action'
import ReviewPage from '../features/review/ReviewPage'
import { createReviewLoader } from '../features/review/ReviewPage.loader'
import { createSubmitReviewSessionAction } from '../features/review/ReviewPage.action'
import SettingsPage from '../features/settings/SettingsPage'
import { createSettingsLoader } from '../features/settings/SettingsPage.loader'
import { createUpdateSettingsAction } from '../features/settings/SettingsPage.action'
import ProfilePage from '../features/profile/ProfilePage'
import { createProfileLoader } from '../features/profile/ProfilePage.loader'
import RouteError from './RouteError'
import NotFoundPage from './NotFoundPage'
import { migrateGuestDataToAccount } from '../application/migrate-guest-data-to-account'
import {
  createAdminGuardLoader,
  requireAdmin,
} from '../features/admin/AdminGuard.loader'
import AdminLayout from '../features/admin/AdminLayout'
import AdminRouteError from '../features/admin/AdminRouteError'
import AdminDashboardPage from '../features/admin/AdminDashboardPage'
import { createAdminDashboardLoader } from '../features/admin/AdminDashboardPage.loader'
import CourseEditorPage from '../features/admin/CourseEditorPage'
import { createCourseEditorLoader } from '../features/admin/CourseEditorPage.loader'
import UnitEditorPage from '../features/admin/UnitEditorPage'
import { createUnitEditorLoader } from '../features/admin/UnitEditorPage.loader'
import LessonEditorPage from '../features/admin/LessonEditorPage'
import { createLessonEditorLoader } from '../features/admin/LessonEditorPage.loader'
import { createAdminAction } from '../features/admin/admin-action'
import HangulGuideTunerPage from '../features/typing/HangulGuideTunerPage'

const localUserProfileRepo = new LocalUserProfileRepository()
const guestSessions = new GuestSessionRepository(
  undefined,
  crypto,
  localUserProfileRepo,
)
const firebaseAuthRepo = new FirebaseAuthRepository()
const adminAuthRepo = new FirebaseAdminAuthRepository()
const adminContentRepo = new FirebaseAdminContentRepository()
const sessionManager = new SessionManager(firebaseAuthRepo, guestSessions)
const guestMigrationRepo = new LocalGuestMigrationRepository()
const accountMigrationRepo = new FirebaseAccountMigrationRepository()
const onePageCheckpointRepo = new LocalOnePageLearningCheckpointRepository()
const migrateGuestData = async (
  guestId: string,
  accountId: string,
): Promise<void> => {
  await migrateGuestDataToAccount(
    guestMigrationRepo,
    accountMigrationRepo,
    guestId,
    accountId,
  )
}
const learners = createLearnerRepositories({
  sessions: sessionManager,
  guest: {
    progressRepo: new LocalProgressRepository(),
    reviewRepo: new LocalReviewRepository(),
    userProfileRepo: localUserProfileRepo,
    sessionSubmissionRepo: new LocalSessionSubmissionRepository(),
  },
  authenticated: {
    progressRepo: firebaseProgressRepo,
    reviewRepo: firebaseReviewRepo,
    userProfileRepo: firebaseUserProfileRepo,
    sessionSubmissionRepo: new FirebaseSessionSubmissionRepository(),
  },
})
const {
  progressRepo,
  reviewRepo,
  userProfileRepo,
  sessionSubmissionRepo,
  getActiveUser,
} = learners
const developmentRoutes = import.meta.env.DEV
  ? [
      { path: '/dev/hangul-guides', Component: HangulGuideTunerPage },
      {
        path: '/dev/jamo-svg',
        lazy: async () => {
          const { default: Component } =
            await import('../features/dev-jamo-svg/HangulSvgInspectorPage')
          return { Component }
        },
      },
      {
        path: '/dev/jamo-svg-tagger',
        lazy: async () => {
          const { default: Component } =
            await import('../features/dev-jamo-svg-tagger/JamoSvgTaggerPage')
          return { Component }
        },
      },
    ]
  : []
export const router = createBrowserRouter([
  {
    path: '/admin',
    Component: AdminLayout,
    loader: createAdminGuardLoader(adminAuthRepo),
    ErrorBoundary: AdminRouteError,
    children: [
      {
        index: true,
        Component: AdminDashboardPage,
        loader: requireAdmin(
          adminAuthRepo,
          createAdminDashboardLoader(adminContentRepo),
        ),
        action: requireAdmin(
          adminAuthRepo,
          createAdminAction(adminContentRepo),
        ),
      },
      {
        path: 'courses/:courseId',
        Component: CourseEditorPage,
        loader: requireAdmin(
          adminAuthRepo,
          createCourseEditorLoader(adminContentRepo),
        ),
        action: requireAdmin(
          adminAuthRepo,
          createAdminAction(adminContentRepo),
        ),
      },
      {
        path: 'units/:unitId',
        Component: UnitEditorPage,
        loader: requireAdmin(
          adminAuthRepo,
          createUnitEditorLoader(adminContentRepo),
        ),
        action: requireAdmin(
          adminAuthRepo,
          createAdminAction(adminContentRepo),
        ),
      },
      {
        path: 'lessons/:lessonId',
        Component: LessonEditorPage,
        loader: requireAdmin(
          adminAuthRepo,
          createLessonEditorLoader(adminContentRepo),
        ),
        action: requireAdmin(
          adminAuthRepo,
          createAdminAction(adminContentRepo),
        ),
      },
    ],
  },
  {
    path: '/',
    Component: CourseListPage,
    loader: createCourseListLoader({
      courseRepo,
      reviewRepo,
      userProfileRepo,
      lessonRepo,
      progressRepo,
      checkpointRepo: onePageCheckpointRepo,
      ensureUser: getActiveUser,
      getSession: () => sessionManager.getActiveSession(),
    }),
    action: createCourseListAction({
      userProfileRepo,
      ensureUser: getActiveUser,
      auth: firebaseAuthRepo,
      getActiveSession: () => sessionManager.getActiveSession(),
      migrateGuestData,
      onePage: {
        courseRepo,
        lessonRepo,
        progressRepo,
        reviewRepo,
        sessionSubmissionRepo,
        checkpointRepo: onePageCheckpointRepo,
      },
    }),
    ErrorBoundary: RouteError,
  },
  {
    path: '/courses/:courseId',
    Component: CourseMapPage,
    loader: createCourseMapLoader({
      courseRepo,
      lessonRepo,
      progressRepo,
      ensureUser: getActiveUser,
    }),
    ErrorBoundary: RouteError,
  },
  {
    path: '/lessons/:lessonId',
    Component: LessonDetailPage,
    loader: createLessonDetailLoader({
      courseRepo,
      lessonRepo,
      userProfileRepo,
      ensureUser: getActiveUser,
    }),
    action: createCompleteLessonSessionAction({
      courseRepo,
      lessonRepo,
      progressRepo,
      userProfileRepo,
      reviewRepo,
      sessionSubmissionRepo,
      ensureUser: getActiveUser,
    }),
    ErrorBoundary: RouteError,
  },
  {
    path: '/review',
    Component: ReviewPage,
    loader: createReviewLoader({
      reviewRepo,
      lessonRepo,
      userProfileRepo,
      ensureUser: getActiveUser,
    }),
    action: createSubmitReviewSessionAction({
      reviewRepo,
      sessionSubmissionRepo,
      ensureUser: getActiveUser,
    }),
    ErrorBoundary: RouteError,
  },
  {
    path: '/settings',
    Component: SettingsPage,
    loader: createSettingsLoader({
      userProfileRepo,
      ensureUser: getActiveUser,
    }),
    action: createUpdateSettingsAction({
      userProfileRepo,
      ensureUser: getActiveUser,
    }),
    shouldRevalidate: ({ actionResult, defaultShouldRevalidate }) =>
      !(
        actionResult &&
        typeof actionResult === 'object' &&
        'error' in actionResult
      ) && defaultShouldRevalidate,
    ErrorBoundary: RouteError,
  },
  {
    path: '/profile',
    Component: ProfilePage,
    loader: createProfileLoader({
      userProfileRepo,
      progressRepo,
      ensureUser: getActiveUser,
    }),
    ErrorBoundary: RouteError,
  },
  ...developmentRoutes,
  {
    path: '*',
    Component: NotFoundPage,
  },
])

sessionManager.onChange(() => {
  const user = firebaseAuthRepo.getCurrentUser()
  if (!user) {
    router.revalidate()
    return
  }
  void guestSessions
    .getStoredGuestSession()
    .then((guest) =>
      guest ? migrateGuestData(guest.guestId, user.uid) : undefined,
    )
    .catch(() => undefined)
    .finally(() => router.revalidate())
})
