import { z } from 'zod'
import type { ActionFunctionArgs } from 'react-router'
import {
  submitReviewSession,
  type SubmitReviewSessionOutcome,
} from '../../application/submit-review-session'
import type { ReviewRepository } from '../../domain/repositories/review-repository'

const reviewSessionResultSchema = z.object({
  results: z.array(
    z.object({
      itemId: z.string(),
      wasCorrect: z.boolean(),
    }),
  ),
})

export function createSubmitReviewSessionAction(deps: {
  reviewRepo: ReviewRepository
  ensureUser: () => Promise<{ uid: string }>
}) {
  return async ({ request }: ActionFunctionArgs): Promise<SubmitReviewSessionOutcome> => {
    const body = reviewSessionResultSchema.parse(await request.json())
    const user = await deps.ensureUser()
    return submitReviewSession(deps.reviewRepo, user.uid, body.results)
  }
}
