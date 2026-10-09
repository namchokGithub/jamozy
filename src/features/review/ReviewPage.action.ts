import { z } from 'zod'
import { jamoCountsSchema } from '../../domain/models/jamo-stat'
import type { ActionFunctionArgs } from 'react-router'
import {
  submitReviewSession,
  type SubmitReviewSessionOutcome,
} from '../../application/submit-review-session'
import type { ReviewRepository } from '../../domain/repositories/review-repository'
import type { SessionSubmissionRepository } from '../../domain/repositories/session-submission-repository'
import type { UserProfileRepository } from '../../domain/repositories/user-profile-repository'

const reviewSessionResultSchema = z.object({
  submissionId: z.string(),
  startedAtMs: z.number().int().nonnegative(),
  durationSeconds: z.number().min(0),
  exercisesAttempted: z.number().int().min(0),
  acceptedKeystrokes: z.number().int().min(0),
  rejectedKeystrokes: z.number().int().min(0),
  results: z.array(
    z.object({
      itemId: z.string(),
      wasCorrect: z.boolean(),
      mistakeCount: z.number().int().min(0).optional(),
      typingSeconds: z.number().min(0).optional(),
      elapsedSeconds: z.number().min(0).optional(),
    }),
  ),
  // Invalid counts are dropped so the review still saves (DEC-050).
  jamoCounts: jamoCountsSchema.optional().catch(undefined),
})

export function createSubmitReviewSessionAction(deps: {
  reviewRepo: ReviewRepository
  sessionSubmissionRepo: SessionSubmissionRepository
  userProfileRepo?: UserProfileRepository
  ensureUser: () => Promise<{ uid: string }>
}) {
  return async ({ request }: ActionFunctionArgs): Promise<SubmitReviewSessionOutcome> => {
    const body = reviewSessionResultSchema.parse(await request.json())
    const user = await deps.ensureUser()
    const { jamoCounts, ...rest } = body
    return submitReviewSession(deps, user.uid, jamoCounts ? { ...rest, jamoCounts } : rest)
  }
}
