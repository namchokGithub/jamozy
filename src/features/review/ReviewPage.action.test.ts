import { describe, expect, it, vi } from 'vitest'
import { createSubmitReviewSessionAction } from './ReviewPage.action'
import { FakeReviewRepository, FakeSessionSubmissionRepository } from '../../test/fakes'
import type { ReviewItem } from '../../domain/models/review-item'

function makeItem(id: string, overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id,
    sourceLessonId: 'l1',
    sourceExerciseId: 'e1',
    targetText: '안녕',
    reason: 'mistake',
    mistakeCount: 1,
    lastMistakeAt: new Date('2026-01-01'),
    resolved: false,
    box: 1,
    nextReviewAt: new Date('2026-01-01'),
    ...overrides,
  }
}

describe('createSubmitReviewSessionAction', () => {
  it('signs in, parses the request body, and submits the review session', async () => {
    const reviewRepo = new FakeReviewRepository()
    await reviewRepo.addReviewItem('user1', makeItem('a'))
    const ensureUser = vi.fn().mockResolvedValue({ uid: 'user1' })
    const action = createSubmitReviewSessionAction({ reviewRepo, sessionSubmissionRepo: new FakeSessionSubmissionRepository(), ensureUser })

    const request = new Request('http://localhost/review', {
      method: 'POST',
      body: JSON.stringify({ submissionId: 'review-1', startedAtMs: 0, durationSeconds: 30, exercisesAttempted: 1, acceptedKeystrokes: 2, rejectedKeystrokes: 0, results: [{ itemId: 'a', wasCorrect: true }] }),
    })

    const outcome = await action({ request } as never)

    expect(ensureUser).toHaveBeenCalledOnce()
    expect(outcome).toEqual({ correctCount: 1, needsPracticeCount: 0 })
  })

  it('rejects a malformed request body', async () => {
    const reviewRepo = new FakeReviewRepository()
    const action = createSubmitReviewSessionAction({
      reviewRepo,
      sessionSubmissionRepo: new FakeSessionSubmissionRepository(),
      ensureUser: vi.fn().mockResolvedValue({ uid: 'user1' }),
    })
    const request = new Request('http://localhost/review', {
      method: 'POST',
      body: JSON.stringify({ results: [{ itemId: 'a' }] }), // missing wasCorrect
    })

    await expect(action({ request } as never)).rejects.toThrow()
  })

  it('passes valid jamo counts and drops invalid ones without failing the review', async () => {
    const sessionSubmissionRepo = new FakeSessionSubmissionRepository()
    const action = createSubmitReviewSessionAction({ reviewRepo: new FakeReviewRepository(), sessionSubmissionRepo, ensureUser: async () => ({ uid: 'user1' }) })
    const body = (submissionId: string, jamoCounts: unknown) => new Request('http://localhost/review', {
      method: 'POST',
      body: JSON.stringify({ submissionId, startedAtMs: 0, durationSeconds: 30, exercisesAttempted: 0, acceptedKeystrokes: 0, rejectedKeystrokes: 0, results: [], jamoCounts }),
    })

    await action({ request: body('valid', { ㄱ: { accepted: 1, rejected: 0 } }) } as never)
    await action({ request: body('invalid', { x: { accepted: -1, rejected: 0 } }) } as never)

    expect(sessionSubmissionRepo.submissions[0]?.effects.jamoCounts).toEqual({ ㄱ: { accepted: 1, rejected: 0 } })
    expect(sessionSubmissionRepo.submissions[1]?.effects).not.toHaveProperty('jamoCounts')
  })
})
