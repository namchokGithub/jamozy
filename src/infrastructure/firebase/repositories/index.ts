import { FirebaseCourseRepository } from './firebase-course-repository'
import { FirebaseLessonRepository } from './firebase-lesson-repository'
import { FirebaseProgressRepository } from './firebase-progress-repository'
import { FirebaseUserProfileRepository } from './firebase-user-profile-repository'
import { FirebaseReviewRepository } from './firebase-review-repository'

export const courseRepo = new FirebaseCourseRepository()
export const lessonRepo = new FirebaseLessonRepository()
export const progressRepo = new FirebaseProgressRepository()
export const userProfileRepo = new FirebaseUserProfileRepository()
export const reviewRepo = new FirebaseReviewRepository()
