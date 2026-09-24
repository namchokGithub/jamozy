import { describe, expect, it, vi } from 'vitest'
import { createCourseListLoader } from './CourseListPage.loader'
import { FakeCourseRepository, FakeReviewRepository } from '../../test/fakes'
import type { Course } from '../../domain/models/course'
import type { ReviewItem } from '../../domain/models/review-item'

function makeCourse(id: string): Course {
  return {
    id,
    title: id,
    description: '',
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeReviewItem(id: string): ReviewItem {
  return {
    id,
    sourceLessonId: 'l1',
    sourceExerciseId: 'e1',
    targetText: '가',
    reason: 'mistake',
    mistakeCount: 1,
    lastMistakeAt: new Date('2026-01-01'),
    resolved: false,
    box: 1,
    nextReviewAt: new Date('2020-01-01'), // well in the past — always due
  }
}

describe('createCourseListLoader', () => {
  it('signs in before reading courses, and returns them alongside the due review count', async () => {
    const ensureUser = vi.fn().mockResolvedValue({ uid: 'user1' })
    const reviewRepo = new FakeReviewRepository()
    await reviewRepo.addReviewItem('user1', makeReviewItem('r1'))
    const loader = createCourseListLoader({
      courseRepo: new FakeCourseRepository([makeCourse('c1')]),
      reviewRepo,
      ensureUser,
    })

    const data = await loader()

    expect(ensureUser).toHaveBeenCalledOnce()
    expect(data.courses.map((c) => c.id)).toEqual(['c1'])
    expect(data.dueReviewCount).toBe(1)
  })

  it('returns the true unbounded due count, not capped to a session-sized batch', async () => {
    const reviewRepo = new FakeReviewRepository()
    for (let i = 0; i < 25; i++) {
      await reviewRepo.addReviewItem('user1', makeReviewItem(`r${i}`))
    }
    const loader = createCourseListLoader({
      courseRepo: new FakeCourseRepository(),
      reviewRepo,
      ensureUser: vi.fn().mockResolvedValue({ uid: 'user1' }),
    })

    const data = await loader()

    expect(data.dueReviewCount).toBe(25)
  })
})
