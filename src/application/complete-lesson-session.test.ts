import { describe, expect, it } from 'vitest'
import { completeLessonSession } from './complete-lesson-session'
import {
  FakeCourseRepository,
  FakeLessonRepository,
  FakeProgressRepository,
  FakeUserProfileRepository,
  FakeReviewRepository,
  FakeSessionSubmissionRepository,
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
      sessionSubmissionRepo: new FakeSessionSubmissionRepository(),
    }

    const outcome = await completeLessonSession(deps, 'user1', 'l1', {
      accuracy: 90,
      speedWpm: 20,
      durationSeconds: 30,
      startedAtMs: new Date('2026-01-01').getTime(),
      exercisesAttempted: 1,
      acceptedKeystrokes: 2,
      rejectedKeystrokes: 0,
      mistakes: [{ sourceExerciseId: 'ex1', targetText: '가' }],
    }, 'session-1')

    expect(outcome.progress.status).toBe('completed')
    expect(deps.sessionSubmissionRepo.submissions[0]?.effects.reviewItems[0]?.id).toBe('ex1')
  })

  it('creates no review items when there are no mistakes', async () => {
    const deps = {
      courseRepo: new FakeCourseRepository([], [makeUnit('u1')]),
      lessonRepo: new FakeLessonRepository([makeLesson('l1', 'u1')]),
      progressRepo: new FakeProgressRepository(),
      userProfileRepo: new FakeUserProfileRepository(),
      reviewRepo: new FakeReviewRepository(),
      sessionSubmissionRepo: new FakeSessionSubmissionRepository(),
    }

    await completeLessonSession(deps, 'user1', 'l1', {
      accuracy: 100,
      speedWpm: 20,
      durationSeconds: 30,
      startedAtMs: new Date('2026-01-01').getTime(),
      exercisesAttempted: 1,
      acceptedKeystrokes: 2,
      rejectedKeystrokes: 0,
      mistakes: [],
    }, 'session-1')

    expect(deps.sessionSubmissionRepo.submissions[0]?.effects.reviewItems).toEqual([])
  })

  it('returns the first completion outcome when the same submission ID is retried', async () => {
    const deps = {
      courseRepo: new FakeCourseRepository([], [makeUnit('u1')]),
      lessonRepo: new FakeLessonRepository([makeLesson('l1', 'u1')]),
      progressRepo: new FakeProgressRepository(),
      userProfileRepo: new FakeUserProfileRepository(),
      reviewRepo: new FakeReviewRepository(),
      sessionSubmissionRepo: new FakeSessionSubmissionRepository(),
    }
    const result = { accuracy: 100, speedWpm: 20, durationSeconds: 30, startedAtMs: 0, exercisesAttempted: 1, acceptedKeystrokes: 2, rejectedKeystrokes: 0, mistakes: [] }

    const first = await completeLessonSession(deps, 'user1', 'l1', result, 'retry-me')
    const retry = await completeLessonSession(deps, 'user1', 'l1', result, 'retry-me')

    expect(first.expGained).toBe(170)
    expect(retry.expGained).toBe(170)
    expect(deps.sessionSubmissionRepo.submissions).toHaveLength(1)
  })
})
