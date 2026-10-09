import { describe, expect, it } from 'vitest'
import { submitReviewSession, type SubmitReviewSessionResult } from './submit-review-session'
import { FakeReviewRepository, FakeSessionSubmissionRepository } from '../test/fakes'
import { FakeUserProfileRepository } from '../test/fakes'
import type { ReviewItem } from '../domain/models/review-item'

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
    nextReviewAt: new Date('2026-01-02'),
    ...overrides,
  }
}

describe('submitReviewSession', () => {
  const now = new Date('2026-01-05')
  const input = (results: SubmitReviewSessionResult[]) => ({ submissionId: 'review-1', startedAtMs: now.getTime(), durationSeconds: 30, exercisesAttempted: results.length, acceptedKeystrokes: results.length, rejectedKeystrokes: 0, results })

  it('advances a correct item and resets an incorrect one, counting each', async () => {
    const repo = new FakeReviewRepository()
    const sessionSubmissionRepo = new FakeSessionSubmissionRepository()
    await repo.addReviewItem('u1', makeItem('a', { box: 2 }))
    await repo.addReviewItem('u1', makeItem('b', { box: 3 }))

    const outcome = await submitReviewSession(
      { reviewRepo: repo, sessionSubmissionRepo },
      'u1',
      input([
        { itemId: 'a', wasCorrect: true },
        { itemId: 'b', wasCorrect: false },
      ]),
      now,
    )

    expect(outcome).toEqual({ correctCount: 1, needsPracticeCount: 1 })
    expect(sessionSubmissionRepo.submissions[0]?.effects.reviewItems.map((item) => item.box)).toEqual([3, 1])
  })

  it('marks an item resolved once a correct answer pushes its box to 5, still counting it correct', async () => {
    const repo = new FakeReviewRepository()
    const sessionSubmissionRepo = new FakeSessionSubmissionRepository()
    await repo.addReviewItem('u1', makeItem('a', { box: 4 }))

    const outcome = await submitReviewSession({ reviewRepo: repo, sessionSubmissionRepo }, 'u1', input([{ itemId: 'a', wasCorrect: true }]), now)

    expect(outcome).toEqual({ correctCount: 1, needsPracticeCount: 0 })
    expect(sessionSubmissionRepo.submissions[0]?.effects.reviewItems[0]?.resolved).toBe(true)
  })

  it('skips an itemId that does not resolve to a ReviewItem under this uid, without throwing', async () => {
    const repo = new FakeReviewRepository()
    const sessionSubmissionRepo = new FakeSessionSubmissionRepository()
    await repo.addReviewItem('u1', makeItem('a'))

    const outcome = await submitReviewSession(
      { reviewRepo: repo, sessionSubmissionRepo },
      'u1',
      input([
        { itemId: 'a', wasCorrect: true },
        { itemId: 'does-not-exist', wasCorrect: true },
      ]),
      now,
    )

    expect(outcome).toEqual({ correctCount: 1, needsPracticeCount: 0 })
  })

  it('never resolves an itemId that belongs to a different user', async () => {
    const repo = new FakeReviewRepository()
    const sessionSubmissionRepo = new FakeSessionSubmissionRepository()
    await repo.addReviewItem('otherUser', makeItem('a'))

    const outcome = await submitReviewSession({ reviewRepo: repo, sessionSubmissionRepo }, 'u1', input([{ itemId: 'a', wasCorrect: true }]), now)

    expect(outcome).toEqual({ correctCount: 0, needsPracticeCount: 0 })
    expect(sessionSubmissionRepo.submissions[0]?.effects.reviewItems).toEqual([])
  })

  it("submits stats using each review item's lesson type", async () => {
    const repo = new FakeReviewRepository()
    const sessionSubmissionRepo = new FakeSessionSubmissionRepository()
    const userProfileRepo = new FakeUserProfileRepository()
    await repo.addReviewItem('u1', makeItem('a', { targetText: '안녕 하세요', sourceLessonType: 'sentence' }))
    await repo.addReviewItem('u1', makeItem('b', { targetText: '가' }))
    await submitReviewSession({ reviewRepo: repo, sessionSubmissionRepo, userProfileRepo }, 'u1', input([{ itemId: 'a', wasCorrect: true, mistakeCount: 0, typingSeconds: 3, elapsedSeconds: 4 }, { itemId: 'b', wasCorrect: false, mistakeCount: 2, typingSeconds: 1, elapsedSeconds: 1 }]), new Date('2026-10-09T01:00:00Z'))
    expect(sessionSubmissionRepo.submissions[0]?.session).toMatchObject({ context: { mode: 'review' }, charactersTyped: 6, sentencesPracticed: 1, wordsPracticed: 0, typingSeconds: 4, exerciseMistakes: [0, 2] })
  })

  it('passes jamo counts to the submission effects', async () => {
    const repo = new FakeReviewRepository()
    const sessionSubmissionRepo = new FakeSessionSubmissionRepository()
    await repo.addReviewItem('u1', makeItem('a'))
    await submitReviewSession({ reviewRepo: repo, sessionSubmissionRepo }, 'u1', { ...input([{ itemId: 'a', wasCorrect: true }]), jamoCounts: { ㄱ: { accepted: 1, rejected: 0 } } })
    expect(sessionSubmissionRepo.submissions[0]?.effects.jamoCounts).toEqual({ ㄱ: { accepted: 1, rejected: 0 } })
  })
})
