import { z } from 'zod'
import type { ActionFunctionArgs } from 'react-router'
import {
  submitReviewSession,
  type SubmitReviewSessionOutcome,
} from '../../application/submit-review-session'
import type { ReviewRepository } from '../../domain/repositories/review-repository'
import type { SessionSubmissionRepository } from '../../domain/repositories/session-submission-repository'

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
    }),
  ),
})

export function createSubmitReviewSessionAction(deps: {
  reviewRepo: ReviewRepository
  sessionSubmissionRepo: SessionSubmissionRepository
  ensureUser: () => Promise<{ uid: string }>
}) {
  return async ({ request }: ActionFunctionArgs): Promise<SubmitReviewSessionOutcome> => {
    const body = reviewSessionResultSchema.parse(await request.json())
    const user = await deps.ensureUser()
    return submitReviewSession(deps, user.uid, body)
  }
}
