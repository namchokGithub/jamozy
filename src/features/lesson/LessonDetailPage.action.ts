import type { ActionFunctionArgs } from 'react-router'
import {
  completeLessonSession,
  type CompleteLessonSessionDeps,
} from '../../application/complete-lesson-session'
import type { CompleteLessonOutcome } from '../../application/complete-lesson'
import { lessonResultSchema } from '../../domain/korean/lesson-session'

// A failed save comes back as data, so the page keeps the learner's result
// and can offer a retry; the submission id makes the retry safe.
export type CompleteLessonActionData = CompleteLessonOutcome | { error: string }

export function createCompleteLessonSessionAction(
  deps: CompleteLessonSessionDeps & {
    ensureUser: () => Promise<{ uid: string }>
  },
) {
  return async ({
    params,
    request,
  }: ActionFunctionArgs): Promise<CompleteLessonActionData> => {
    const lessonId = params.lessonId
    if (!lessonId) {
      throw new Error('Lesson id is required')
    }
    const body = (await request.json()) as Record<string, unknown>
    const result = lessonResultSchema.parse(body)
    if (typeof body.submissionId !== 'string')
      throw new Error('Submission id is required')
    try {
      const user = await deps.ensureUser()
      return await completeLessonSession(
        deps,
        user.uid,
        lessonId,
        result,
        body.submissionId,
      )
    } catch (error) {
      if (import.meta.env.DEV)
        console.warn('[lesson] Saving the result failed.', error)
      return {
        error:
          'Your result could not be saved. Check your connection and try again.',
      }
    }
  }
}
