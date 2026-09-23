import { FirebaseCourseRepository } from './firebase-course-repository'
import { FirebaseLessonRepository } from './firebase-lesson-repository'
import { FirebaseProgressRepository } from './firebase-progress-repository'

export const courseRepo = new FirebaseCourseRepository()
export const lessonRepo = new FirebaseLessonRepository()
export const progressRepo = new FirebaseProgressRepository()
