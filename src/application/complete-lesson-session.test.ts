import { describe, expect, it } from 'vitest'
import { completeLessonSession } from './complete-lesson-session'
import {
  FakeCourseRepository,
  FakeLessonRepository,
  FakeProgressRepository,
  FakeUserProfileRepository,
  FakeReviewRepository,
} from '../test/fakes'
import type { Lesson } from '../domain/models/lesson'
import type { Unit } from '../domain/models/unit'

function makeUnit(id: string): Unit {
  return {
    id,
    courseId: 'c1',
    title: id,
    description: '',
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeLesson(id: string, unitId: string): Lesson {
  return {
    id,
    unitId,
    title: id,
    type: 'word',
    order: 1,
    exercises: [
      {
        id: 'ex1',
        targetText: '가',
        romanization: null,
        meaningTh: '',
        meaningEn: '',
        difficulty: 'easy',
        hint: null,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('completeLessonSession', () => {
  it('completes the lesson and creates a review item for each reported mistake', async () => {
    const deps = {
      courseRepo: new FakeCourseRepository([], [makeUnit('u1')]),
      lessonRepo: new FakeLessonRepository([makeLesson('l1', 'u1')]),
      progressRepo: new FakeProgressRepository(),
      userProfileRepo: new FakeUserProfileRepository(),
      reviewRepo: new FakeReviewRepository(),
    }

    const outcome = await completeLessonSession(deps, 'user1', 'l1', {
      accuracy: 90,
      speedWpm: 20,
      durationSeconds: 30,
      mistakes: [{ sourceExerciseId: 'ex1', targetText: '가' }],
    })

    expect(outcome.progress.status).toBe('completed')
    const reviewItem = await deps.reviewRepo.getReviewItem('user1', 'ex1')
    expect(reviewItem).not.toBeNull()
  })

  it('creates no review items when there are no mistakes', async () => {
    const deps = {
      courseRepo: new FakeCourseRepository([], [makeUnit('u1')]),
      lessonRepo: new FakeLessonRepository([makeLesson('l1', 'u1')]),
      progressRepo: new FakeProgressRepository(),
      userProfileRepo: new FakeUserProfileRepository(),
      reviewRepo: new FakeReviewRepository(),
    }

    await completeLessonSession(deps, 'user1', 'l1', {
      accuracy: 100,
      speedWpm: 20,
      durationSeconds: 30,
      mistakes: [],
    })

    const reviewItems = await deps.reviewRepo.getReviewItems('user1')
    expect(reviewItems).toEqual([])
  })
})
