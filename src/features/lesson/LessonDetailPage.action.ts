import type { ActionFunctionArgs } from 'react-router'
import {
  completeLessonSession,
  type CompleteLessonSessionDeps,
} from '../../application/complete-lesson-session'
import type { CompleteLessonOutcome } from '../../application/complete-lesson'
import { lessonResultSchema } from '../../domain/korean/lesson-session'

export function createCompleteLessonSessionAction(
  deps: CompleteLessonSessionDeps & { ensureUser: () => Promise<{ uid: string }> },
) {
  return async ({ params, request }: ActionFunctionArgs): Promise<CompleteLessonOutcome> => {
    const lessonId = params.lessonId
    if (!lessonId) {
      throw new Error('Lesson id is required')
    }
    const body = await request.json() as Record<string, unknown>
    const result = lessonResultSchema.parse(body)
    if (typeof body.submissionId !== 'string') throw new Error('Submission id is required')
    const user = await deps.ensureUser()
    return completeLessonSession(deps, user.uid, lessonId, result, body.submissionId)
  }
}
