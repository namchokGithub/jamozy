import type { ActionFunctionArgs } from 'react-router'
import { updateDisplayName } from '../../application/update-display-name'
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from '../../application/authenticate'
import type { UserProfileRepository } from '../../domain/repositories/user-profile-repository'
import type { AuthRepository } from '../../domain/repositories/auth-repository'
import type { UserSession } from '../../domain/models/user-session'
import type { CourseRepository } from '../../domain/repositories/course-repository'
import type { LessonRepository } from '../../domain/repositories/lesson-repository'
import type { ProgressRepository } from '../../domain/repositories/progress-repository'
import type { ReviewRepository } from '../../domain/repositories/review-repository'
import type { SessionSubmissionRepository } from '../../domain/repositories/session-submission-repository'
import type { OnePageLearningCheckpointRepository } from '../../domain/repositories/one-page-learning-checkpoint-repository'
import { completeLessonSession } from '../../application/complete-lesson-session'
import { getCheckpointedLessonCompletion, recordOnePageExercise } from '../../application/save-one-page-checkpoint'
import { exerciseResultSchema } from '../../domain/korean/lesson-session'

export function createCourseListAction(deps: { userProfileRepo: UserProfileRepository; ensureUser: () => Promise<{ uid: string }>; auth?: AuthRepository; getActiveSession?: () => Promise<UserSession>; migrateGuestData?: (guestId: string, accountId: string) => Promise<void>; onePage?: { courseRepo: CourseRepository; lessonRepo: LessonRepository; progressRepo: ProgressRepository; reviewRepo: ReviewRepository; sessionSubmissionRepo: SessionSubmissionRepository; checkpointRepo: OnePageLearningCheckpointRepository } }) {
  return async ({ request }: ActionFunctionArgs) => {
    const body = await request.json() as { displayName?: string; intent?: string; email?: string; password?: string; courseId?: string; lessonId?: string; result?: unknown }
    if ((body.intent === 'one-page-exercise-completed' || body.intent === 'one-page-retry-completion') && deps.onePage) {
      if (!body.courseId || !body.lessonId) throw new Error('Course and lesson are required')
      const user = await deps.ensureUser()
      const lesson = await deps.onePage.lessonRepo.getLessonById(body.lessonId)
      if (!lesson) throw new Error('Lesson not found')
      const checkpointed = body.intent === 'one-page-exercise-completed'
        ? await (async () => {
            const result = exerciseResultSchema.parse(body.result)
            const exercise = lesson.exercises.find((item) => item.id === result.exerciseId)
            if (!exercise || exercise.targetText !== result.targetText) throw new Error('Exercise does not belong to lesson')
            return recordOnePageExercise(deps.onePage!.checkpointRepo, { userId: user.uid, courseId: body.courseId!, lesson, result })
          })()
        : await (async () => {
            const checkpoint = await deps.onePage!.checkpointRepo.getCheckpoint(user.uid, body.courseId!)
            if (!checkpoint) throw new Error('No saved lesson completion found')
            return { checkpoint, completedLesson: getCheckpointedLessonCompletion(checkpoint, lesson) }
          })()
      if (!checkpointed.completedLesson) return { onePageCheckpointed: true }
      const outcome = await completeLessonSession({
        courseRepo: deps.onePage.courseRepo,
        lessonRepo: deps.onePage.lessonRepo,
        progressRepo: deps.onePage.progressRepo,
        userProfileRepo: deps.userProfileRepo,
        reviewRepo: deps.onePage.reviewRepo,
        sessionSubmissionRepo: deps.onePage.sessionSubmissionRepo,
      }, user.uid, checkpointed.completedLesson.lessonId, checkpointed.completedLesson.result, checkpointed.completedLesson.submissionId)
      await deps.onePage.checkpointRepo.clearLesson(user.uid, body.courseId, lesson.id)
      return { onePageCheckpointed: true, outcome }
    }
    if (body.intent && deps.auth) {
      try {
        if (body.intent === 'sign-out') {
          await deps.auth.signOut()
          return { authenticated: true }
        }
        const active = deps.getActiveSession ? await deps.getActiveSession() : null
        const user = body.intent === 'sign-up'
          ? await signUpWithEmail(deps.auth, deps.userProfileRepo, body.email ?? '', body.password ?? '')
          : body.intent === 'sign-in'
            ? await signInWithEmail(deps.auth, deps.userProfileRepo, body.email ?? '', body.password ?? '')
            : await signInWithGoogle(deps.auth, deps.userProfileRepo)
        try {
          if (active?.kind === 'guest' && deps.migrateGuestData) await deps.migrateGuestData(active.userId, user.uid)
          return { authenticated: true }
        } catch (error) {
          return { authenticated: true, migrationError: error instanceof Error ? error.message : 'Migration will retry later' }
        }
      } catch (error) { return { error: error instanceof Error ? error.message : 'Unable to sign in' } }
    }
    const displayName = body.displayName ?? ''
    const user = await deps.ensureUser()
    const profile = await updateDisplayName(deps.userProfileRepo, user.uid, displayName)
    return { displayName: profile.displayName }
  }
}
