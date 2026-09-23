import { describe, expect, it } from 'vitest'
import { completeLesson, type CompleteLessonDeps } from './complete-lesson'
import {
  FakeCourseRepository,
  FakeLessonRepository,
  FakeProgressRepository,
  FakeUserProfileRepository,
} from '../test/fakes'
import type { Course } from '../domain/models/course'
import type { Unit } from '../domain/models/unit'
import type { Lesson, LessonExercise } from '../domain/models/lesson'

function makeExercise(id: string): LessonExercise {
  return {
    id,
    targetText: '안녕',
    romanization: 'annyeong',
    meaningTh: 'สวัสดี',
    meaningEn: 'hello',
    difficulty: 'easy',
    hint: null,
  }
}

function makeLesson(id: string, unitId: string, order: number): Lesson {
  return {
    id,
    unitId,
    title: id,
    type: 'word',
    order,
    exercises: [makeExercise(`${id}-e1`), makeExercise(`${id}-e2`)],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeUnit(id: string, courseId: string, order: number): Unit {
  return { id, courseId, title: id, description: '', order, createdAt: new Date(), updatedAt: new Date() }
}

function makeCourse(id: string): Course {
  return { id, title: id, description: '', order: 1, createdAt: new Date(), updatedAt: new Date() }
}

function makeDeps(): CompleteLessonDeps {
  const course = makeCourse('c1')
  const units = [makeUnit('u1', 'c1', 1), makeUnit('u2', 'c1', 2)]
  const lessons = [
    makeLesson('l1', 'u1', 1),
    makeLesson('l2', 'u1', 2),
    makeLesson('l3', 'u2', 1),
  ]
  return {
    courseRepo: new FakeCourseRepository([course], units),
    lessonRepo: new FakeLessonRepository(lessons),
    progressRepo: new FakeProgressRepository(),
    userProfileRepo: new FakeUserProfileRepository(),
  }
}

const now = new Date('2026-01-01')

describe('completeLesson', () => {
  it('completes the lesson, awards base EXP, and unlocks the next lesson in the same unit', async () => {
    const deps = makeDeps()
    const outcome = await completeLesson(
      deps,
      'u1',
      'l1',
      { accuracy: 70, speedWpm: 30, durationSeconds: 60 },
      now,
    )

    expect(outcome.progress.status).toBe('completed')
    expect(outcome.expGained).toBe(100)
    expect(outcome.unlockedNextLessonId).toBe('l2')
    expect(outcome.level).toBe(2)

    const nextProgress = await deps.progressRepo.getProgress('u1', 'l2')
    expect(nextProgress?.status).toBe('unlocked')
  })

  it('awards accuracy and perfect bonuses', async () => {
    const deps = makeDeps()
    const outcome = await completeLesson(
      deps,
      'u1',
      'l1',
      { accuracy: 100, speedWpm: 30, durationSeconds: 60 },
      now,
    )

    expect(outcome.expGained).toBe(170)
  })

  it('unlocks the first lesson of the next unit after the last lesson in a unit', async () => {
    const deps = makeDeps()
    const outcome = await completeLesson(
      deps,
      'u1',
      'l2',
      { accuracy: 80, speedWpm: 30, durationSeconds: 60 },
      now,
    )

    expect(outcome.unlockedNextLessonId).toBe('l3')
    const nextProgress = await deps.progressRepo.getProgress('u1', 'l3')
    expect(nextProgress?.status).toBe('unlocked')
  })

  it('returns null unlockedNextLessonId at the end of the course', async () => {
    const deps = makeDeps()
    const outcome = await completeLesson(
      deps,
      'u1',
      'l3',
      { accuracy: 80, speedWpm: 30, durationSeconds: 60 },
      now,
    )

    expect(outcome.unlockedNextLessonId).toBeNull()
  })

  it('does not re-award EXP or re-unlock on a retry of an already-completed lesson', async () => {
    const deps = makeDeps()
    await completeLesson(
      deps,
      'u1',
      'l1',
      { accuracy: 70, speedWpm: 30, durationSeconds: 60 },
      now,
    )

    const retry = await completeLesson(
      deps,
      'u1',
      'l1',
      { accuracy: 100, speedWpm: 50, durationSeconds: 40 },
      now,
    )

    expect(retry.expGained).toBe(0)
    expect(retry.unlockedNextLessonId).toBeNull()
    expect(retry.progress.attempts).toBe(2)
    expect(retry.progress.bestAccuracy).toBe(100)
  })

  it('updates lessonsCompleted and wordsPracticed stats on first completion', async () => {
    const deps = makeDeps()
    await completeLesson(
      deps,
      'u1',
      'l1',
      { accuracy: 90, speedWpm: 30, durationSeconds: 60 },
      now,
    )

    const profile = await deps.userProfileRepo.getUserProfile('u1')
    expect(profile?.stats.lessonsCompleted).toBe(1)
    expect(profile?.stats.wordsPracticed).toBe(2)
    expect(profile?.stats.totalTypingTimeSeconds).toBe(60)
  })
})
