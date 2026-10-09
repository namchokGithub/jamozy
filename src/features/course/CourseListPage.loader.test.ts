import { describe, expect, it, vi } from 'vitest'
import { createCourseListLoader } from './CourseListPage.loader'
import { FakeCourseRepository, FakeOnePageLearningCheckpointRepository, FakeProgressRepository, FakeReviewRepository, FakeUserProfileRepository } from '../../test/fakes'
import type { LessonRepository } from '../../domain/repositories/lesson-repository'
import type { Unit } from '../../domain/models/unit'
import type { ProgressRepository } from '../../domain/repositories/progress-repository'
import type { Course } from '../../domain/models/course'
import type { ReviewItem } from '../../domain/models/review-item'
import { defaultUserProfile } from '../../domain/models/user-profile'

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
  it('exposes sound settings from one profile read without waiting for review data', async () => {
    const profile = defaultUserProfile('user1', new Date('2026-01-01'))
    const profiles = new FakeUserProfileRepository()
    await profiles.saveUserProfile('user1', {
      ...profile,
      settings: { ...profile.settings, soundEnabled: false, keyboardSoundPack: 'mxblue' },
    })
    const profileRead = vi.spyOn(profiles, 'getUserProfile')
    const reviews = new FakeReviewRepository()
    let releaseReviews: () => void = () => {}
    const gate = new Promise<void>((resolve) => { releaseReviews = resolve })
    reviews.getReviewItems = async () => { await gate; return [] }
    const loader = createCourseListLoader({
      courseRepo: new FakeCourseRepository(),
      reviewRepo: reviews,
      userProfileRepo: profiles,
      ensureUser: async () => ({ uid: 'user1' }),
    })

    const data = await loader()
    await expect(data.settings).resolves.toMatchObject({
      soundEnabled: false,
      keyboardSoundPack: 'mxblue',
    })
    expect(profileRead).toHaveBeenCalledOnce()
    releaseReviews()
    await data.page
  })
  it('signs in before reading courses, and returns them alongside the due review count', async () => {
    const ensureUser = vi.fn().mockResolvedValue({ uid: 'user1' })
    const reviewRepo = new FakeReviewRepository()
    await reviewRepo.addReviewItem('user1', makeReviewItem('r1'))
    const loader = createCourseListLoader({
      courseRepo: new FakeCourseRepository([makeCourse('c1')]),
      reviewRepo,
      ensureUser,
    })

    const page = await (await loader()).page

    expect(ensureUser).toHaveBeenCalledOnce()
    expect(page.courses.map((c) => c.id)).toEqual(['c1'])
    expect(page.dueReviewCount).toBe(1)
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

    const page = await (await loader()).page

    expect(page.dueReviewCount).toBe(25)
  })

  it('returns the persisted Guest display name', async () => {
    const profiles = new FakeUserProfileRepository()
    await profiles.saveUserProfile('user1', { id: 'user1', displayName: 'Guest#1245', exp: 0, settings: { soundEnabled: true, keyboardSoundPack: 'turquoise', showKeyboard: true, showEnglishKeys: true, keyboardOpacity: 0.7, romanizationEnabled: true, meaningLanguage: 'both', theme: 'light' }, stats: { lessonsCompleted: 0, wordsPracticed: 0, averageAccuracy: 0, bestAccuracy: 0, averageSpeedWpm: 0, totalTypingTimeSeconds: 0 }, createdAt: new Date(), updatedAt: new Date() })
    const loader = createCourseListLoader({ courseRepo: new FakeCourseRepository(), reviewRepo: new FakeReviewRepository(), userProfileRepo: profiles, ensureUser: async () => ({ uid: 'user1' }) })
    expect((await (await loader()).page).displayName).toBe('Guest#1245')
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

    expect((await data.page).courses.map((c) => c.id)).toEqual(['c1'])
    releaseLessons()
    await expect(data.onePageLearningPath).resolves.toMatchObject({ selectedCourseId: null, queue: [] })
    expect(getCourses).toHaveBeenCalledOnce()
  })

  describe('Home player (DEC-043)', () => {
    const content = {
      schemaVersion: 1 as const,
      exportedAt: '2026-10-06T00:00:00.000Z',
      course: { id: 'home', title: 'Home', description: '' },
      units: [{
        id: 'u1', title: 'Basics', description: '', order: 0,
        lessons: [{ id: 'l1', title: 'Jamo', type: 'character' as const, order: 0, exercises: [{ id: 'e1', targetText: 'ㄱ', romanization: 'k', meaningTh: '', meaningEn: '', difficulty: 'easy' as const, hint: null }] }],
      }],
    }
    const localState = {
      getCachedProgress: async () => [],
      saveCachedProgress: async () => {},
      getResume: async () => null,
      saveResume: async () => {},
    }

    function homeLoader(homeContent: typeof content | null, progressRepo: ProgressRepository) {
      const lessonRepo: LessonRepository = {
        getLessonsByUnitId: vi.fn(async () => []),
        getLessonById: async () => null,
      }
      const loader = createCourseListLoader({
        courseRepo: new FakeCourseRepository([makeCourse('c1')]),
        reviewRepo: new FakeReviewRepository(),
        lessonRepo,
        progressRepo,
        checkpointRepo: new FakeOnePageLearningCheckpointRepository(),
        home: { contentRepo: { getHomeContent: async () => homeContent }, localState, pendingExerciseIds: async () => new Map() },
        ensureUser: async () => ({ uid: 'user1' }),
      })
      return { loader, lessonRepo }
    }

    it('plays Home content without loading the Learning Path player or waiting on live Progress', async () => {
      let releaseProgress: () => void = () => {}
      const gate = new Promise<void>((resolve) => { releaseProgress = resolve })
      const progressRepo = new FakeProgressRepository()
      const getAllProgress = progressRepo.getAllProgress.bind(progressRepo)
      progressRepo.getAllProgress = async (userId: string) => { await gate; return getAllProgress(userId) }
      const { loader, lessonRepo } = homeLoader(content, progressRepo)

      const data = await loader()

      await expect(data.homePlayer).resolves.toMatchObject({ content })
      await expect(data.onePageLearningPath).resolves.toBeNull()
      expect(lessonRepo.getLessonsByUnitId).not.toHaveBeenCalled()
      releaseProgress()
      await expect(data.homeProgress).resolves.toEqual([])
    })

    it('falls back to the Learning Path player without Home content', async () => {
      const { loader } = homeLoader(null, new FakeProgressRepository())

      const data = await loader()

      await expect(data.homePlayer).resolves.toBeNull()
      await expect(data.homeProgress).resolves.toBeNull()
      await expect(data.onePageLearningPath).resolves.toMatchObject({ queue: [] })
    })

    it('keeps the cached Progress when live Progress cannot be read', async () => {
      const progressRepo = new FakeProgressRepository()
      progressRepo.getAllProgress = async () => { throw new Error('offline') }
      const { loader } = homeLoader(content, progressRepo)

      const data = await loader()

      await expect(data.homeProgress).resolves.toBeNull()
    })

    it('requests home.json before the user is known', async () => {
      const order: string[] = []
      let releaseUser: () => void = () => {}
      const userGate = new Promise<void>((resolve) => { releaseUser = resolve })
      const loader = createCourseListLoader({
        courseRepo: new FakeCourseRepository(),
        reviewRepo: new FakeReviewRepository(),
        home: {
          contentRepo: { getHomeContent: async () => { order.push('content'); return content } },
          localState,
          pendingExerciseIds: async () => new Map(),
        },
        ensureUser: async () => { await userGate; order.push('user'); return { uid: 'user1' } },
      })

      const loading = loader()
      await Promise.resolve()
      releaseUser()
      const data = await loading

      await expect(data.homePlayer).resolves.toMatchObject({ content })
      expect(order).toEqual(['content', 'user'])
    })

    it('prefetches the opening lesson\'s targets once Home content is known', async () => {
      const prefetchTargets = vi.fn()
      const twoLessons = {
        ...content,
        units: [{ ...content.units[0], lessons: [
          content.units[0].lessons[0],
          { ...content.units[0].lessons[0], id: 'l2', exercises: [{ ...content.units[0].lessons[0].exercises[0], id: 'e2', targetText: '가방' }] },
        ] }],
      }
      const loader = createCourseListLoader({
        courseRepo: new FakeCourseRepository(),
        reviewRepo: new FakeReviewRepository(),
        home: {
          contentRepo: { getHomeContent: async () => twoLessons },
          localState: { ...localState, getResume: async () => ({ unitId: 'u1', lessonId: 'l2' }) },
          pendingExerciseIds: async () => new Map(),
          prefetchTargets,
        },
        ensureUser: async () => ({ uid: 'user1' }),
      })

      await (await loader()).homePlayer

      expect(prefetchTargets).toHaveBeenCalledWith(['가방'])
    })
  })

  it('returns before the Firestore page data resolves', async () => {
    let releaseReviews: () => void = () => {}
    const gate = new Promise<void>((resolve) => { releaseReviews = resolve })
    const reviewRepo = new FakeReviewRepository()
    const getReviewItems = reviewRepo.getReviewItems.bind(reviewRepo)
    reviewRepo.getReviewItems = async (userId: string) => { await gate; return getReviewItems(userId) }
    const loader = createCourseListLoader({
      courseRepo: new FakeCourseRepository([makeCourse('c1')]),
      reviewRepo,
      ensureUser: async () => ({ uid: 'user1' }),
    })

    const data = await loader()

    releaseReviews()
    await expect(data.page).resolves.toMatchObject({ dueReviewCount: 0 })
  })
})
