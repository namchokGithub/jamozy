import { describe, expect, it } from 'vitest'
import { submitReviewResult } from './submit-review-result'
import { FakeReviewRepository } from '../test/fakes'
import type { ReviewItem } from '../domain/models/review-item'

function makeItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: 'e1',
    sourceLessonId: 'l1',
    sourceExerciseId: 'ex1',
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

describe('submitReviewResult', () => {
  const now = new Date('2026-01-05')

  it('advances the box and schedules the next review on a correct answer', async () => {
    const repo = new FakeReviewRepository()
    const item = makeItem({ box: 2 })
    const updated = await submitReviewResult(repo, 'u1', item, true, now)

    expect(updated.box).toBe(3)
    expect(updated.nextReviewAt).toEqual(new Date('2026-01-12'))
    expect(updated.resolved).toBe(false)
  })

  it('marks resolved once the box reaches 5 on a correct answer', async () => {
    const repo = new FakeReviewRepository()
    const item = makeItem({ box: 4 })
    const updated = await submitReviewResult(repo, 'u1', item, true, now)

    expect(updated.box).toBe(5)
    expect(updated.resolved).toBe(true)
  })

  it('resets the box to 1 and records the mistake on a wrong answer', async () => {
    const repo = new FakeReviewRepository()
    const item = makeItem({ box: 4, mistakeCount: 2 })
    const updated = await submitReviewResult(repo, 'u1', item, false, now)

    expect(updated.box).toBe(1)
    expect(updated.mistakeCount).toBe(3)
    expect(updated.lastMistakeAt).toEqual(now)
    expect(updated.resolved).toBe(false)
  })
})
