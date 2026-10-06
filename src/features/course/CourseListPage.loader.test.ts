import { describe, expect, it, vi } from 'vitest'
import { createCourseListLoader } from './CourseListPage.loader'
import { FakeCourseRepository, FakeOnePageLearningCheckpointRepository, FakeProgressRepository, FakeReviewRepository, FakeUserProfileRepository } from '../../test/fakes'
import type { LessonRepository } from '../../domain/repositories/lesson-repository'
import type { Unit } from '../../domain/models/unit'
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

  it('returns the persisted Guest display name', async () => {
    const profiles = new FakeUserProfileRepository()
    await profiles.saveUserProfile('user1', { id: 'user1', displayName: 'Guest#1245', exp: 0, settings: { soundEnabled: true, showKeyboard: true, showEnglishKeys: true, keyboardOpacity: 0.7, romanizationEnabled: true, meaningLanguage: 'both', theme: 'light' }, stats: { lessonsCompleted: 0, wordsPracticed: 0, averageAccuracy: 0, bestAccuracy: 0, averageSpeedWpm: 0, totalTypingTimeSeconds: 0 }, createdAt: new Date(), updatedAt: new Date() })
    const loader = createCourseListLoader({ courseRepo: new FakeCourseRepository(), reviewRepo: new FakeReviewRepository(), userProfileRepo: profiles, ensureUser: async () => ({ uid: 'user1' }) })
    expect((await loader()).displayName).toBe('Guest#1245')
  })

  it('returns page data without waiting for the Home player path, querying courses once', async () => {
    const courseRepo = new FakeCourseRepository(
      [makeCourse('c1')],
      [{ id: 'u1', courseId: 'c1', title: 'u1', description: '', order: 1, createdAt: new Date(), updatedAt: new Date() } satisfies Unit],
    )
    const getCourses = vi.spyOn(courseRepo, 'getCourses')
    let releaseLessons: () => void = () => {}
    const lessonsGate = new Promise<void>((resolve) => { releaseLessons = resolve })
    const lessonRepo: LessonRepository = {
      getLessonsByUnitId: () => lessonsGate.then(() => []),
      getLessonById: async () => null,
    }
    const loader = createCourseListLoader({
      courseRepo,
      reviewRepo: new FakeReviewRepository(),
      lessonRepo,
      progressRepo: new FakeProgressRepository(),
      checkpointRepo: new FakeOnePageLearningCheckpointRepository(),
      ensureUser: async () => ({ uid: 'user1' }),
    })

    const data = await loader()

    expect(data.courses.map((c) => c.id)).toEqual(['c1'])
    releaseLessons()
    await expect(data.onePageLearningPath).resolves.toMatchObject({ selectedCourseId: null, queue: [] })
    expect(getCourses).toHaveBeenCalledOnce()
  })
})
