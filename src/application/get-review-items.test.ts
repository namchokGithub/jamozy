import { describe, expect, it } from 'vitest'
import { getDueReviewItems } from './get-review-items'
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

describe('getDueReviewItems', () => {
  const now = new Date('2026-01-05')

  it('includes unresolved items due at or before now', async () => {
    const repo = new FakeReviewRepository()
    await repo.addReviewItem('u1', makeItem('due', { nextReviewAt: now }))
    const items = await getDueReviewItems(repo, 'u1', now)
    expect(items.map((i) => i.id)).toEqual(['due'])
  })

  it('excludes items not yet due', async () => {
    const repo = new FakeReviewRepository()
    await repo.addReviewItem(
      'u1',
      makeItem('future', { nextReviewAt: new Date('2026-02-01') }),
    )
    expect(await getDueReviewItems(repo, 'u1', now)).toEqual([])
  })

  it('excludes resolved items', async () => {
    const repo = new FakeReviewRepository()
    await repo.addReviewItem(
      'u1',
      makeItem('resolved', { resolved: true, nextReviewAt: now }),
    )
    expect(await getDueReviewItems(repo, 'u1', now)).toEqual([])
  })

  it('returns every due item when no limit is given (unbounded)', async () => {
    const repo = new FakeReviewRepository()
    for (let i = 0; i < 25; i++) {
      await repo.addReviewItem('u1', makeItem(`due-${i}`, { nextReviewAt: now }))
    }
    const items = await getDueReviewItems(repo, 'u1', now)
    expect(items).toHaveLength(25)
  })

  it('caps the returned items to an explicit limit, without dropping the rest from the repository', async () => {
    const repo = new FakeReviewRepository()
    for (let i = 0; i < 5; i++) {
      await repo.addReviewItem('u1', makeItem(`due-${i}`, { nextReviewAt: now }))
    }
    const items = await getDueReviewItems(repo, 'u1', now, 3)
    expect(items).toHaveLength(3)

    const allStillThere = await repo.getReviewItems('u1')
    expect(allStillThere.filter((i) => !i.resolved && i.nextReviewAt <= now)).toHaveLength(5)
  })
})
