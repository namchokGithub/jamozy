import { describe, expect, it, vi } from 'vitest'
import { createReviewLoader } from './ReviewPage.loader'
import {
  FakeLessonRepository,
  FakeReviewRepository,
  FakeUserProfileRepository,
} from '../../test/fakes'
import type { ReviewItem } from '../../domain/models/review-item'
import type { Lesson } from '../../domain/models/lesson'
import { defaultUserProfile } from '../../domain/models/user-profile'

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

function makeLesson(id: string): Lesson {
  return {
    id,
    unitId: 'u1',
    title: id,
    type: 'word',
    order: 1,
    exercises: [
      {
        id: 'e1',
        targetText: '안녕',
        romanization: 'annyeong',
        meaningTh: 'สวัสดี',
        meaningEn: 'Hello',
        difficulty: 'easy',
        hint: null,
      },
    ],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  }
}

describe('createReviewLoader', () => {
  it('signs in, then returns up to 20 enriched previews with default settings', async () => {
    const ensureUser = vi.fn().mockResolvedValue({ uid: 'user1' })
    const reviewRepo = new FakeReviewRepository()
    for (let i = 0; i < 25; i++) {
      await reviewRepo.addReviewItem('user1', makeItem(`due-${i}`))
    }
    const loader = createReviewLoader({
      reviewRepo,
      lessonRepo: new FakeLessonRepository([makeLesson('l1')]),
      userProfileRepo: new FakeUserProfileRepository(),
      ensureUser,
    })

    const data = await loader()

    expect(ensureUser).toHaveBeenCalledOnce()
    expect(data.previews).toHaveLength(20)
    expect(data.previews[0].exercise?.romanization).toBe('annyeong')
    expect(data.settings).toMatchObject({ keyboardOpacity: 0.7, meaningLanguage: 'both' })
  })

  it('keeps a missing source as a Korean-only preview and returns saved settings', async () => {
    const reviewRepo = new FakeReviewRepository()
    await reviewRepo.addReviewItem('user1', makeItem('missing', { sourceLessonId: 'gone' }))
    const userProfileRepo = new FakeUserProfileRepository()
    const profile = defaultUserProfile('user1', new Date('2026-01-01'))
    await userProfileRepo.saveUserProfile('user1', {
      ...profile,
      settings: { ...profile.settings, romanizationEnabled: false, meaningLanguage: 'th' },
    })
    const loader = createReviewLoader({
      reviewRepo,
      lessonRepo: new FakeLessonRepository(),
      userProfileRepo,
      ensureUser: vi.fn().mockResolvedValue({ uid: 'user1' }),
    })

    const data = await loader()

    expect(data.previews).toEqual([{ item: makeItem('missing', { sourceLessonId: 'gone' }), exercise: null }])
    expect(data.settings).toMatchObject({ romanizationEnabled: false, meaningLanguage: 'th' })
  })
})
