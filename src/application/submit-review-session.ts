import type { ReviewRepository } from '../domain/repositories/review-repository'
import type { SessionSubmissionRepository } from '../domain/repositories/session-submission-repository'
import { nextBox, nextReviewDate, type ReviewItem } from '../domain/models/review-item'

export interface SubmitReviewSessionResult {
  itemId: string
  wasCorrect: boolean
}

export interface SubmitReviewSessionOutcome {
  correctCount: number
  needsPracticeCount: number
}

export interface SubmitReviewSessionInput {
  submissionId: string
  startedAtMs: number
  durationSeconds: number
  exercisesAttempted: number
  acceptedKeystrokes: number
  rejectedKeystrokes: number
  results: SubmitReviewSessionResult[]
}

function updatedReview(item: ReviewItem, wasCorrect: boolean, now: Date): ReviewItem {
  const box = nextBox(item.box, wasCorrect)
  return {
    ...item,
    box,
    nextReviewAt: nextReviewDate(box, now),
    resolved: wasCorrect && box === 5,
    mistakeCount: wasCorrect ? item.mistakeCount : item.mistakeCount + 1,
    lastMistakeAt: wasCorrect ? item.lastMistakeAt : now,
  }
}

export async function submitReviewSession(
  deps: { reviewRepo: ReviewRepository; sessionSubmissionRepo: SessionSubmissionRepository },
  userId: string,
  input: SubmitReviewSessionInput,
  now: Date = new Date(),
): Promise<SubmitReviewSessionOutcome> {
  let correctCount = 0
  let needsPracticeCount = 0
  const reviewItems: ReviewItem[] = []

  for (const { itemId, wasCorrect } of input.results) {
    const item = await deps.reviewRepo.getReviewItem(userId, itemId)
    if (!item) continue

    reviewItems.push(updatedReview(item, wasCorrect, now))
    if (wasCorrect) {
      correctCount += 1
    } else {
      needsPracticeCount += 1
    }
  }

  await deps.sessionSubmissionRepo.submit(userId, {
    id: input.submissionId,
    context: { mode: 'review' },
    startedAt: new Date(input.startedAtMs),
    completedAt: now,
    durationSeconds: input.durationSeconds,
    exercisesAttempted: input.exercisesAttempted,
    acceptedKeystrokes: input.acceptedKeystrokes,
    rejectedKeystrokes: input.rejectedKeystrokes,
    expGained: 0,
  }, { progress: [], reviewItems })

  return { correctCount, needsPracticeCount }
}
