import { createBrowserRouter } from 'react-router'
import {
  courseRepo,
  lessonRepo,
  progressRepo,
  userProfileRepo,
  reviewRepo,
} from '../infrastructure/firebase/repositories'
import { signInAnonymouslyIfNeeded } from '../infrastructure/firebase/firebase'
import CourseListPage from '../features/course/CourseListPage'
import { createCourseListLoader } from '../features/course/CourseListPage.loader'
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

export const router = createBrowserRouter([
  {
    path: '/',
    Component: CourseListPage,
    loader: createCourseListLoader({
      courseRepo,
      reviewRepo,
      ensureUser: signInAnonymouslyIfNeeded,
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
      ensureUser: signInAnonymouslyIfNeeded,
    }),
    ErrorBoundary: RouteError,
  },
  {
    path: '/lessons/:lessonId',
    Component: LessonDetailPage,
    loader: createLessonDetailLoader({
      lessonRepo,
      userProfileRepo,
      ensureUser: signInAnonymouslyIfNeeded,
    }),
    action: createCompleteLessonSessionAction({
      courseRepo,
      lessonRepo,
      progressRepo,
      userProfileRepo,
      reviewRepo,
      ensureUser: signInAnonymouslyIfNeeded,
    }),
    ErrorBoundary: RouteError,
  },
  {
    path: '/review',
    Component: ReviewPage,
    loader: createReviewLoader({
      reviewRepo,
      ensureUser: signInAnonymouslyIfNeeded,
    }),
    action: createSubmitReviewSessionAction({
      reviewRepo,
      ensureUser: signInAnonymouslyIfNeeded,
    }),
    ErrorBoundary: RouteError,
  },
  {
    path: '/settings',
    Component: SettingsPage,
    loader: createSettingsLoader({
      userProfileRepo,
      ensureUser: signInAnonymouslyIfNeeded,
    }),
    action: createUpdateSettingsAction({
      userProfileRepo,
      ensureUser: signInAnonymouslyIfNeeded,
    }),
    ErrorBoundary: RouteError,
  },
  {
    path: '/profile',
    Component: ProfilePage,
    loader: createProfileLoader({
      userProfileRepo,
      ensureUser: signInAnonymouslyIfNeeded,
    }),
    ErrorBoundary: RouteError,
  },
  {
    path: '*',
    Component: NotFoundPage,
  },
])
