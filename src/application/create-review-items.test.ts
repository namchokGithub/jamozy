import { describe, expect, it, vi } from 'vitest'
import { createReviewItemsFromMistakes } from './create-review-items'
import { FakeReviewRepository } from '../test/fakes'

describe('createReviewItemsFromMistakes', () => {
  const now = new Date('2026-01-01')

  it('creates a fresh ReviewItem when none exists for the exercise', async () => {
    const reviewRepo = new FakeReviewRepository()

    await createReviewItemsFromMistakes(
      reviewRepo,
      'user1',
      'lesson1',
      [{ sourceExerciseId: 'ex1', targetText: '가' }],
      now,
    )

    const item = await reviewRepo.getReviewItem('user1', 'ex1')
    expect(item).toMatchObject({
      id: 'ex1',
      sourceLessonId: 'lesson1',
      sourceExerciseId: 'ex1',
      targetText: '가',
      reason: 'mistake',
      mistakeCount: 1,
      resolved: false,
      box: 1,
    })
  })

  it('increments mistakeCount and resets box to 1 for an existing ReviewItem', async () => {
    const reviewRepo = new FakeReviewRepository()
    await reviewRepo.addReviewItem('user1', {
      id: 'ex1',
      sourceLessonId: 'lesson1',
      sourceExerciseId: 'ex1',
      targetText: '가',
      reason: 'mistake',
      mistakeCount: 2,
      lastMistakeAt: new Date('2025-01-01'),
      resolved: true,
      box: 4,
      nextReviewAt: new Date('2025-02-01'),
    })

    await createReviewItemsFromMistakes(
      reviewRepo,
      'user1',
      'lesson1',
      [{ sourceExerciseId: 'ex1', targetText: '가' }],
      now,
    )

    const item = await reviewRepo.getReviewItem('user1', 'ex1')
    expect(item?.mistakeCount).toBe(3)
    expect(item?.box).toBe(1)
    expect(item?.resolved).toBe(false)
  })

  it('never calls getReviewItems (only point lookups by id)', async () => {
    const reviewRepo = new FakeReviewRepository()
    const getReviewItemsSpy = vi.spyOn(reviewRepo, 'getReviewItems')

    await createReviewItemsFromMistakes(
      reviewRepo,
      'user1',
      'lesson1',
      [{ sourceExerciseId: 'ex1', targetText: '가' }],
      now,
    )

    expect(getReviewItemsSpy).not.toHaveBeenCalled()
  })

  it('does nothing for an empty mistakes list', async () => {
    const reviewRepo = new FakeReviewRepository()
    const getReviewItemSpy = vi.spyOn(reviewRepo, 'getReviewItem')

    await createReviewItemsFromMistakes(reviewRepo, 'user1', 'lesson1', [], now)

    expect(getReviewItemSpy).not.toHaveBeenCalled()
  })
})
