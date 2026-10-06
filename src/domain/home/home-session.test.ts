import { describe, expect, it } from 'vitest'
import {
  homeLessonProgress,
  homeReplayTotals,
  nextHomeLesson,
  resolveHomeResume,
  shuffleExercises,
} from './home-session'
import { pressKey, startLessonSession } from '../korean/lesson-session'
import type { Progress } from '../models/progress'

const units = [
  {
    id: 'u1',
    lessons: [
      { id: 'l1', exercises: [{ id: 'a' }, { id: 'b' }] },
      { id: 'l2', exercises: [{ id: 'c' }] },
    ],
  },
  { id: 'u2', lessons: [{ id: 'l3', exercises: [{ id: 'd' }] }] },
]

const progress = (overrides: Partial<Progress>): Progress => ({
  lessonId: 'l1',
  status: 'unlocked',
  bestAccuracy: 0,
  bestSpeedWpm: 0,
  attempts: 0,
  lastAttemptAt: null,
  completedAt: null,
  ...overrides,
})

// Deterministic sequence for Math.random-style callers.
const sequence =
  (...values: number[]) =>
  () =>
    values.shift() ?? 0

describe('shuffleExercises', () => {
  it('returns every exercise exactly once without changing the input', () => {
    const exercises = ['e1', 'e2', 'e3', 'e4', 'e5']
    const shuffled = shuffleExercises(exercises, sequence(0.1, 0.9, 0.5, 0.3))

    expect([...shuffled].sort()).toEqual(exercises)
    expect(exercises).toEqual(['e1', 'e2', 'e3', 'e4', 'e5'])
  })

  it('uses the random source (Fisher-Yates)', () => {
    // i=2 picks j=0, i=1 picks j=0: [a,b,c] → [c,b,a] → [b,c,a]
    expect(shuffleExercises(['a', 'b', 'c'], sequence(0, 0))).toEqual([
      'b',
      'c',
      'a',
    ])
  })
})

describe('nextHomeLesson', () => {
  it('moves to the next lesson in the unit, then the first lesson of the next unit', () => {
    expect(nextHomeLesson(units, 'l1')).toEqual({
      unitId: 'u1',
      lessonId: 'l2',
    })
    expect(nextHomeLesson(units, 'l2')).toEqual({
      unitId: 'u2',
      lessonId: 'l3',
    })
  })

  it('returns null after the last lesson of the last unit', () => {
    expect(nextHomeLesson(units, 'l3')).toBeNull()
  })

  it('skips units without lessons', () => {
    expect(
      nextHomeLesson([units[0], { id: 'empty', lessons: [] }, units[1]], 'l2'),
    ).toEqual({ unitId: 'u2', lessonId: 'l3' })
  })
})

describe('resolveHomeResume', () => {
  it('returns the saved lesson when it still exists', () => {
    expect(resolveHomeResume(units, { unitId: 'u2', lessonId: 'l3' })).toEqual({
      unitId: 'u2',
      lessonId: 'l3',
    })
  })

  it('falls back to the first lesson when nothing is saved or the lesson is gone', () => {
    expect(resolveHomeResume(units, null)).toEqual({
      unitId: 'u1',
      lessonId: 'l1',
    })
    expect(
      resolveHomeResume(units, { unitId: 'u9', lessonId: 'gone' }),
    ).toEqual({ unitId: 'u1', lessonId: 'l1' })
  })

  it("uses the lesson's current unit when it moved", () => {
    expect(resolveHomeResume(units, { unitId: 'u1', lessonId: 'l3' })).toEqual({
      unitId: 'u2',
      lessonId: 'l3',
    })
  })

  it('returns null for content without lessons', () => {
    expect(resolveHomeResume([], null)).toBeNull()
  })
})

describe('homeLessonProgress', () => {
  const lesson = units[0].lessons[0]

  it('counts distinct completed exercises that still belong to the lesson', () => {
    expect(homeLessonProgress(lesson, null)).toEqual({ done: 0, total: 2 })
    expect(
      homeLessonProgress(
        lesson,
        progress({ completedExerciseIds: ['a', 'removed'] }),
      ),
    ).toEqual({ done: 1, total: 2 })
  })

  it('adds exercises still waiting to sync', () => {
    expect(
      homeLessonProgress(
        lesson,
        progress({ completedExerciseIds: ['a'] }),
        new Set(['a', 'b']),
      ),
    ).toEqual({ done: 2, total: 2 })
  })

  it('shows a completed lesson as full', () => {
    expect(
      homeLessonProgress(
        lesson,
        progress({ status: 'completed', completedExerciseIds: [] }),
      ),
    ).toEqual({ done: 2, total: 2 })
  })
})

describe('homeReplayTotals', () => {
  it('derives replay session totals from a finished lesson session', () => {
    let state = startLessonSession(
      [{ id: 'a', targetText: '가' }],
      new Date('2026-10-06T00:00:00Z'),
    )
    state = pressKey(state, 'KeyS', false)
    state = pressKey(state, 'KeyR', false)
    state = pressKey(state, 'KeyK', false)

    expect(homeReplayTotals(state, new Date('2026-10-06T00:00:30Z'))).toEqual({
      startedAtMs: new Date('2026-10-06T00:00:00Z').getTime(),
      durationSeconds: 30,
      exercisesAttempted: 1,
      acceptedKeystrokes: 2,
      rejectedKeystrokes: 1,
    })
  })
})
