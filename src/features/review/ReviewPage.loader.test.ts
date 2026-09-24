import { describe, expect, it, vi } from 'vitest'
import { createReviewLoader } from './ReviewPage.loader'
import { FakeReviewRepository } from '../../test/fakes'
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

describe('createReviewLoader', () => {
  it('signs in, then returns up to 20 due items', async () => {
    const ensureUser = vi.fn().mockResolvedValue({ uid: 'user1' })
    const reviewRepo = new FakeReviewRepository()
    for (let i = 0; i < 25; i++) {
      await reviewRepo.addReviewItem('user1', makeItem(`due-${i}`))
    }
    const loader = createReviewLoader({ reviewRepo, ensureUser })

    const data = await loader()

    expect(ensureUser).toHaveBeenCalledOnce()
    expect(data.items).toHaveLength(20)
  })
})
