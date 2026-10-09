import { z } from 'zod'
import type { ActionFunctionArgs } from 'react-router'
import {
  submitWeakJamoSession,
  type SubmitWeakJamoSessionOutcome,
} from '../../application/submit-weak-jamo-session'
import { jamoCountsSchema } from '../../domain/models/jamo-stat'
import type { SessionSubmissionRepository } from '../../domain/repositories/session-submission-repository'
import type { UserProfileRepository } from '../../domain/repositories/user-profile-repository'

const weakJamoSessionSchema = z.object({
  submissionId: z.string().min(1),
  startedAtMs: z.number().int().nonnegative(),
  durationSeconds: z.number().min(0),
  exercisesAttempted: z.number().int().min(0),
  acceptedKeystrokes: z.number().int().min(0),
  rejectedKeystrokes: z.number().int().min(0),
  results: z
    .array(
      z.object({
        exerciseId: z.string().min(1),
        targetText: z.string(),
        lessonType: z.enum(['character', 'syllable', 'word', 'phrase', 'sentence']),
        wasCorrect: z.boolean(),
        mistakeCount: z.number().int().min(0),
        typingSeconds: z.number().min(0),
        elapsedSeconds: z.number().min(0),
      }),
    )
    .max(50),
  // Invalid counts are dropped so the practice still saves (DEC-050).
  jamoCounts: jamoCountsSchema.optional().catch(undefined),
})

// A failed save comes back as data, so the page can retry with the same
// submission id (the receipt makes the retry safe).
export type WeakJamoActionData = SubmitWeakJamoSessionOutcome | { error: string }

export function createSubmitWeakJamoSessionAction(deps: {
  sessionSubmissionRepo: SessionSubmissionRepository
  userProfileRepo?: UserProfileRepository
  ensureUser: () => Promise<{ uid: string }>
}) {
  return async ({ request }: ActionFunctionArgs): Promise<WeakJamoActionData> => {
    const { jamoCounts, ...rest } = weakJamoSessionSchema.parse(
      await request.json(),
    )
    try {
      const user = await deps.ensureUser()
      return await submitWeakJamoSession(
        deps,
        user.uid,
        jamoCounts ? { ...rest, jamoCounts } : rest,
      )
    } catch (error) {
      if (import.meta.env.DEV)
        console.warn('[weak-jamo] Saving the practice failed.', error)
      return {
        error: 'Your practice could not be saved. Check your connection and try again.',
      }
    }
  }
}
