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
import { defaultUserProfile } from '../domain/models/user-profile'
import { emptySessionAggregate } from '../domain/models/session-aggregate'

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

    const outcome = await completeLessonSession(
      deps,
      'user1',
      'l1',
      {
        accuracy: 90,
        speedWpm: 20,
        durationSeconds: 30,
        startedAtMs: new Date('2026-01-01').getTime(),
        exercisesAttempted: 1,
        acceptedKeystrokes: 2,
        rejectedKeystrokes: 0,
        mistakes: [{ sourceExerciseId: 'ex1', targetText: '가' }],
      },
      'session-1',
    )

    expect(outcome.progress.status).toBe('completed')
    expect(
      deps.sessionSubmissionRepo.submissions[0]?.effects.reviewItems[0]?.id,
    ).toBe('ex1')
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

    await completeLessonSession(
      deps,
      'user1',
      'l1',
      {
        accuracy: 100,
        speedWpm: 20,
        durationSeconds: 30,
        startedAtMs: new Date('2026-01-01').getTime(),
        exercisesAttempted: 1,
        acceptedKeystrokes: 2,
        rejectedKeystrokes: 0,
        mistakes: [],
      },
      'session-1',
    )

    expect(
      deps.sessionSubmissionRepo.submissions[0]?.effects.reviewItems,
    ).toEqual([])
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
    const result = {
      accuracy: 100,
      speedWpm: 20,
      durationSeconds: 30,
      startedAtMs: 0,
      exercisesAttempted: 1,
      acceptedKeystrokes: 2,
      rejectedKeystrokes: 0,
      mistakes: [],
    }

    const first = await completeLessonSession(
      deps,
      'user1',
      'l1',
      result,
      'retry-me',
    )
    const retry = await completeLessonSession(
      deps,
      'user1',
      'l1',
      result,
      'retry-me',
    )

    expect(first.expGained).toBe(170)
    expect(retry.expGained).toBe(170)
    expect(deps.sessionSubmissionRepo.submissions).toHaveLength(1)
  })

  it('derives the outcome level from legacy and session-tracked EXP', async () => {
    const deps = {
      courseRepo: new FakeCourseRepository([], [makeUnit('u1')]),
      lessonRepo: new FakeLessonRepository([makeLesson('l1', 'u1')]),
      progressRepo: new FakeProgressRepository(),
      userProfileRepo: new FakeUserProfileRepository(),
      reviewRepo: new FakeReviewRepository(),
      sessionSubmissionRepo: new FakeSessionSubmissionRepository(),
    }
    const profile = defaultUserProfile('user1', new Date('2026-01-01'))
    await deps.userProfileRepo.saveUserProfile('user1', {
      ...profile,
      sessionAggregate: { ...emptySessionAggregate(), exp: 630 },
    })
    const result = {
      accuracy: 100,
      speedWpm: 20,
      durationSeconds: 30,
      startedAtMs: 0,
      exercisesAttempted: 1,
      acceptedKeystrokes: 2,
      rejectedKeystrokes: 0,
      mistakes: [],
    }

    const first = await completeLessonSession(
      deps,
      'user1',
      'l1',
      result,
      'level-check',
    )
    // The adapter has already added the first submission to the aggregate.
    await deps.userProfileRepo.saveUserProfile('user1', {
      ...profile,
      sessionAggregate: { ...emptySessionAggregate(), exp: 800 },
    })
    const retry = await completeLessonSession(
      deps,
      'user1',
      'l1',
      result,
      'level-check',
    )

    expect(first.level).toBe(5)
    expect(retry.level).toBe(5)
  })

  it('awards 15 EXP for an intentional replay of a completed lesson', async () => {
    const deps = {
      courseRepo: new FakeCourseRepository([], [makeUnit('u1')]),
      lessonRepo: new FakeLessonRepository([makeLesson('l1', 'u1')]),
      progressRepo: new FakeProgressRepository(),
      userProfileRepo: new FakeUserProfileRepository(),
      reviewRepo: new FakeReviewRepository(),
      sessionSubmissionRepo: new FakeSessionSubmissionRepository(),
    }
    await deps.progressRepo.saveProgress('user1', {
      lessonId: 'l1',
      status: 'completed',
      bestAccuracy: 100,
      bestSpeedWpm: 20,
      attempts: 1,
      lastAttemptAt: new Date('2026-01-01'),
      completedAt: new Date('2026-01-01'),
    })

    const outcome = await completeLessonSession(
      deps,
      'user1',
      'l1',
      {
        accuracy: 100,
        speedWpm: 20,
        durationSeconds: 30,
        startedAtMs: new Date('2026-01-02').getTime(),
        exercisesAttempted: 1,
        acceptedKeystrokes: 2,
        rejectedKeystrokes: 0,
        mistakes: [],
      },
      'replay-1',
      new Date('2026-01-02'),
    )

    expect(outcome.expGained).toBe(15)
    expect(outcome.progress.status).toBe('completed')
    expect(outcome.unlockedNextLessonId).toBeNull()
    expect(deps.sessionSubmissionRepo.submissions[0]?.session.isReplay).toBe(true)
  })

  it('includes per-exercise player stats and lesson type in the submitted session', async () => {
    const deps = { courseRepo: new FakeCourseRepository([], [makeUnit('u1')]), lessonRepo: new FakeLessonRepository([makeLesson('l1', 'u1')]), progressRepo: new FakeProgressRepository(), userProfileRepo: new FakeUserProfileRepository(), reviewRepo: new FakeReviewRepository(), sessionSubmissionRepo: new FakeSessionSubmissionRepository() }
    await deps.userProfileRepo.saveUserProfile('user1', { ...defaultUserProfile('user1', new Date()), timezone: 'Asia/Bangkok' })
    await completeLessonSession(deps, 'user1', 'l1', { accuracy: 90, speedWpm: 20, durationSeconds: 30, startedAtMs: 0, exercisesAttempted: 2, acceptedKeystrokes: 5, rejectedKeystrokes: 1, mistakes: [{ sourceExerciseId: 'ex1', targetText: '사과' }], exercises: [{ targetText: '사과', mistakeCount: 0, typingSeconds: 2, elapsedSeconds: 3 }, { targetText: '바나나', mistakeCount: 1, typingSeconds: 4, elapsedSeconds: 5 }] }, 'stats-1', new Date('2026-10-09T17:30:00Z'))
    expect(deps.sessionSubmissionRepo.submissions[0]?.session).toMatchObject({ localDate: '2026-10-10', timeZone: 'Asia/Bangkok', typingSeconds: 6, charactersTyped: 5, wordsPracticed: 2, exerciseMistakes: [0, 1], isReplay: false })
    expect(deps.sessionSubmissionRepo.submissions[0]?.effects.reviewItems[0]).toMatchObject({ sourceLessonType: 'word' })
  })

  // Firestore rejects undefined field values, so a missing lesson must leave
  // the key out rather than store sourceLessonType: undefined.
  it('omits the source lesson type from review items when the lesson is not found', async () => {
    const deps = { courseRepo: new FakeCourseRepository([], [makeUnit('u1')]), lessonRepo: new FakeLessonRepository([]), progressRepo: new FakeProgressRepository(), userProfileRepo: new FakeUserProfileRepository(), reviewRepo: new FakeReviewRepository(), sessionSubmissionRepo: new FakeSessionSubmissionRepository() }
    const result = { accuracy: 50, speedWpm: 20, durationSeconds: 30, startedAtMs: 0, exercisesAttempted: 2, acceptedKeystrokes: 2, rejectedKeystrokes: 2, mistakes: [{ sourceExerciseId: 'ex1', targetText: '가' }] }
    await completeLessonSession(deps, 'user1', 'l1', result, 'missing-1', new Date('2026-01-02'))
    expect(deps.sessionSubmissionRepo.submissions[0]?.effects.reviewItems[0]).not.toHaveProperty('sourceLessonType')

    await deps.reviewRepo.addReviewItem('user1', { ...deps.sessionSubmissionRepo.submissions[0]!.effects.reviewItems[0]!, id: 'ex2', sourceExerciseId: 'ex2' })
    await completeLessonSession(deps, 'user1', 'l1', { ...result, mistakes: [{ sourceExerciseId: 'ex2', targetText: '가' }] }, 'missing-2', new Date('2026-01-03'))
    expect(deps.sessionSubmissionRepo.submissions[1]?.effects.reviewItems[0]).not.toHaveProperty('sourceLessonType')
  })
})
