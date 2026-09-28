import { createBrowserRouter } from 'react-router'
import { courseRepo, lessonRepo, progressRepo as firebaseProgressRepo, userProfileRepo as firebaseUserProfileRepo, reviewRepo as firebaseReviewRepo } from '../infrastructure/firebase/repositories'
import { GuestSessionRepository } from '../infrastructure/local/guest-session-repository'
import { LocalProgressRepository, LocalReviewRepository, LocalUserProfileRepository } from '../infrastructure/local/local-repositories'
import { createLearnerRepositories } from './learner-repositories'
import { FirebaseAuthRepository } from '../infrastructure/firebase/firebase-auth-repository'
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

const localUserProfileRepo = new LocalUserProfileRepository()
const guestSessions = new GuestSessionRepository(undefined, crypto, localUserProfileRepo)
const firebaseAuthRepo = new FirebaseAuthRepository()
const sessionManager = new SessionManager(firebaseAuthRepo, guestSessions)
const learners = createLearnerRepositories({
  sessions: sessionManager,
  guest: { progressRepo: new LocalProgressRepository(), reviewRepo: new LocalReviewRepository(), userProfileRepo: localUserProfileRepo },
  authenticated: { progressRepo: firebaseProgressRepo, reviewRepo: firebaseReviewRepo, userProfileRepo: firebaseUserProfileRepo },
})
const { progressRepo, reviewRepo, userProfileRepo, getActiveUser } = learners
export const router = createBrowserRouter([
  {
    path: '/',
    Component: CourseListPage,
    loader: createCourseListLoader({
      courseRepo,
      reviewRepo,
      userProfileRepo,
      ensureUser: getActiveUser,
      getSession: () => sessionManager.getActiveSession(),
    }),
    action: createCourseListAction({ userProfileRepo, ensureUser: getActiveUser, auth: firebaseAuthRepo }),
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
    ErrorBoundary: RouteError,
  },
  {
    path: '/profile',
    Component: ProfilePage,
    loader: createProfileLoader({
      userProfileRepo,
      ensureUser: getActiveUser,
    }),
    ErrorBoundary: RouteError,
  },
  {
    path: '*',
    Component: NotFoundPage,
  },
])

sessionManager.onChange(() => router.revalidate())
