import { describe, expect, it } from 'vitest'
import { submitReviewSession } from './submit-review-session'
import { FakeReviewRepository } from '../test/fakes'
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

  it('advances a correct item and resets an incorrect one, counting each', async () => {
    const repo = new FakeReviewRepository()
    await repo.addReviewItem('u1', makeItem('a', { box: 2 }))
    await repo.addReviewItem('u1', makeItem('b', { box: 3 }))

    const outcome = await submitReviewSession(
      repo,
      'u1',
      [
        { itemId: 'a', wasCorrect: true },
        { itemId: 'b', wasCorrect: false },
      ],
      now,
    )

    expect(outcome).toEqual({ correctCount: 1, needsPracticeCount: 1 })
    expect((await repo.getReviewItem('u1', 'a'))?.box).toBe(3)
    expect((await repo.getReviewItem('u1', 'b'))?.box).toBe(1)
  })

  it('marks an item resolved once a correct answer pushes its box to 5, still counting it correct', async () => {
    const repo = new FakeReviewRepository()
    await repo.addReviewItem('u1', makeItem('a', { box: 4 }))

    const outcome = await submitReviewSession(repo, 'u1', [{ itemId: 'a', wasCorrect: true }], now)

    expect(outcome).toEqual({ correctCount: 1, needsPracticeCount: 0 })
    expect((await repo.getReviewItem('u1', 'a'))?.resolved).toBe(true)
  })

  it('skips an itemId that does not resolve to a ReviewItem under this uid, without throwing', async () => {
    const repo = new FakeReviewRepository()
    await repo.addReviewItem('u1', makeItem('a'))

    const outcome = await submitReviewSession(
      repo,
      'u1',
      [
        { itemId: 'a', wasCorrect: true },
        { itemId: 'does-not-exist', wasCorrect: true },
      ],
      now,
    )

    expect(outcome).toEqual({ correctCount: 1, needsPracticeCount: 0 })
  })

  it('never resolves an itemId that belongs to a different user', async () => {
    const repo = new FakeReviewRepository()
    await repo.addReviewItem('otherUser', makeItem('a'))

    const outcome = await submitReviewSession(repo, 'u1', [{ itemId: 'a', wasCorrect: true }], now)

    expect(outcome).toEqual({ correctCount: 0, needsPracticeCount: 0 })
    expect((await repo.getReviewItem('otherUser', 'a'))?.box).toBe(1) // untouched
  })
})
