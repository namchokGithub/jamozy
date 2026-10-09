import { describe, expect, it } from 'vitest'
import {
  appendExercises,
  compactLessonSession,
  getLessonProgress,
  getLessonResult,
  pressKey,
  startLessonSession,
  lessonResultSchema,
  exerciseResultSchema,
  type LessonSessionState,
} from './lesson-session'
import { startTypingSession, type MistakeEvent } from './typing-session'

describe('startLessonSession', () => {
  it('starts typing with the first exercise loaded', () => {
    const state = startLessonSession([
      { id: 'e1', targetText: '가' },
      { id: 'e2', targetText: '나' },
    ])
    expect(state.status).toBe('typing')
    expect(state.currentIndex).toBe(0)
    expect(state.currentSession.targetText).toBe('가')
    expect(state.completedResults).toEqual([])
  })

  it('starts already completed for an empty exercise list', () => {
    const state = startLessonSession([])
    expect(state.status).toBe('completed')
  })
})

describe('pressKey', () => {
  it('auto-advances to the next exercise and records results as each completes', () => {
    let state = startLessonSession([
      { id: 'e1', targetText: '가' }, // ㄱ(KeyR) ㅏ(KeyK)
      { id: 'e2', targetText: '나' }, // ㄴ(KeyS) ㅏ(KeyK)
    ])

    state = pressKey(state, 'KeyR', false)
    state = pressKey(state, 'KeyK', false) // 가 complete — auto-advance
    expect(state.currentIndex).toBe(1)
    expect(state.status).toBe('typing')
    expect(state.completedResults).toEqual([
      {
        exerciseId: 'e1',
        targetText: '가',
        correctKeyCount: 2,
        mistakes: [],
        typingSeconds: 0,
        elapsedSeconds: 0,
      },
    ])
    expect(state.currentSession.targetText).toBe('나')

    state = pressKey(state, 'KeyS', false)
    state = pressKey(state, 'KeyK', false) // 나 complete — lesson done
    expect(state.status).toBe('completed')
    expect(state.completedResults).toHaveLength(2)
  })

  it('ignores pressKey once the lesson session is completed', () => {
    let state = startLessonSession([{ id: 'e1', targetText: '가' }])
    state = pressKey(state, 'KeyR', false)
    state = pressKey(state, 'KeyK', false)
    expect(state.status).toBe('completed')

    const completed = state
    state = pressKey(state, 'KeyR', false)
    expect(state).toEqual(completed)
  })
})

describe('exercise timing', () => {
  it('sums keystroke gaps up to 10 seconds and skips longer gaps', () => {
    let state = startLessonSession([{ id: 'e1', targetText: '가' }])
    state = pressKey(state, 'KeyR', false, 1_000)
    state = pressKey(state, 'KeyK', false, 13_000)
    expect(state.lastCompletedExercise?.typingSeconds).toBe(0)
    expect(state.lastCompletedExercise?.elapsedSeconds).toBe(12)
  })

  it('counts a gap of exactly 10 seconds', () => {
    let state = startLessonSession([{ id: 'e1', targetText: '가' }])
    state = pressKey(state, 'KeyR', false, 0)
    state = pressKey(state, 'KeyK', false, 10_000)
    expect(state.lastCompletedExercise?.typingSeconds).toBe(10)
  })

  it('restarts timing for the next exercise and counts wrong keys', () => {
    let state = startLessonSession([
      { id: 'e1', targetText: '가' },
      { id: 'e2', targetText: '가' },
    ])
    state = pressKey(state, 'KeyR', false, 0)
    state = pressKey(state, 'KeyK', false, 1_000)
    state = pressKey(state, 'KeyQ', false, 60_000)
    state = pressKey(state, 'KeyR', false, 61_000)
    state = pressKey(state, 'KeyK', false, 63_000)
    expect(state.completedResults[1]).toMatchObject({
      typingSeconds: 3,
      elapsedSeconds: 3,
    })
  })

  it('records zero time when no clock is passed', () => {
    let state = startLessonSession([{ id: 'e1', targetText: '가' }])
    state = pressKey(state, 'KeyR', false)
    state = pressKey(state, 'KeyK', false)
    expect(state.lastCompletedExercise).toMatchObject({
      typingSeconds: 0,
      elapsedSeconds: 0,
    })
  })

  it('reports per-exercise stats in the lesson result', () => {
    let state = startLessonSession([{ id: 'e1', targetText: '가' }])
    state = pressKey(state, 'KeyQ', false, 0)
    state = pressKey(state, 'KeyR', false, 1_000)
    state = pressKey(state, 'KeyK', false, 2_000)
    expect(getLessonResult(state).exercises).toEqual([
      {
        targetText: '가',
        mistakeCount: 1,
        typingSeconds: 2,
        elapsedSeconds: 2,
      },
    ])
  })

  it('clears the last completed exercise on a modifier key without timing it', () => {
    let state = startLessonSession([
      { id: 'e1', targetText: '가' },
      { id: 'e2', targetText: '가' },
    ])
    state = pressKey(state, 'KeyR', false, 0)
    state = pressKey(state, 'KeyK', false, 1_000)
    state = pressKey(state, 'ShiftLeft', true, 2_000)
    expect(state.lastCompletedExercise).toBeNull()
    state = pressKey(state, 'KeyR', false, 30_000)
    state = pressKey(state, 'KeyK', false, 31_000)
    expect(state.completedResults[1]).toMatchObject({
      typingSeconds: 1,
      elapsedSeconds: 1,
    })
  })

  it('still parses an exercise result saved before timing existed', () => {
    expect(
      exerciseResultSchema.parse({
        exerciseId: 'e1',
        targetText: '가',
        correctKeyCount: 2,
        mistakes: [],
      }),
    ).not.toHaveProperty('typingSeconds')
  })
})

function makeMistake(): MistakeEvent {
  return {
    syllableIndex: 0,
    expectedCode: 'KeyR',
    expectedShift: false,
    expectedJamo: 'ㄱ',
    pressedCode: 'KeyT',
    pressedShift: false,
  }
}

describe('getLessonResult', () => {
  it("computes accuracy on a 0-100 scale (not the engine's internal 0-1) and lists exercises with mistakes", () => {
    const state: LessonSessionState = {
      exercises: [],
      currentIndex: 0,
      currentSession: startTypingSession(''),
      completedResults: [
        { exerciseId: 'e1', targetText: '가', correctKeyCount: 9, mistakes: [] },
        { exerciseId: 'e2', targetText: '나', correctKeyCount: 0, mistakes: [makeMistake()] },
      ],
      lastCompletedExercise: null,
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
      status: 'completed',
    }

    const result = getLessonResult(state, new Date('2026-01-01T00:01:00.000Z'))

    expect(result.accuracy).toBe(90) // 9 correct / (9 correct + 1 mistake) * 100
    expect(result.mistakes).toEqual([{ sourceExerciseId: 'e2', targetText: '나' }])
  })

  it('computes WPM from physical keystrokes, not displayed characters', () => {
    const state: LessonSessionState = {
      exercises: [],
      currentIndex: 0,
      currentSession: startTypingSession(''),
      completedResults: [{ exerciseId: 'e1', targetText: '값', correctKeyCount: 10, mistakes: [] }],
      lastCompletedExercise: null,
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
      status: 'completed',
    }

    const result = getLessonResult(state, new Date('2026-01-01T00:01:00.000Z')) // 60s later

    expect(result.durationSeconds).toBe(60)
    expect(result.speedWpm).toBe(2) // (10 keystrokes / 5) / (60s / 60) = 2
  })

  it('returns all zeros for a lesson with no exercises', () => {
    const state = startLessonSession([])
    const result = getLessonResult(state, state.startedAt) // same instant, duration 0
    expect(result).toEqual({ accuracy: 0, speedWpm: 0, durationSeconds: 0, startedAtMs: state.startedAt.getTime(), exercisesAttempted: 0, acceptedKeystrokes: 0, rejectedKeystrokes: 0, mistakes: [], exercises: [] })
  })
})

describe('getLessonProgress', () => {
  it('reports completed exercises against the total', () => {
    let state = startLessonSession([
      { id: 'e1', targetText: '가' },
      { id: 'e2', targetText: '나' },
    ])
    expect(getLessonProgress(state)).toEqual({ current: 0, total: 2 })

    state = pressKey(state, 'KeyR', false)
    state = pressKey(state, 'KeyK', false)
    expect(getLessonProgress(state)).toEqual({ current: 1, total: 2 })
  })
})

describe('lessonResultSchema', () => {
  it('accepts a valid result', () => {
    expect(() =>
      lessonResultSchema.parse({ accuracy: 90, speedWpm: 2, durationSeconds: 60, startedAtMs: 0, exercisesAttempted: 1, acceptedKeystrokes: 10, rejectedKeystrokes: 0, mistakes: [] }),
    ).not.toThrow()
  })

  it('rejects an out-of-range accuracy', () => {
    expect(() =>
      lessonResultSchema.parse({ accuracy: 150, speedWpm: 2, durationSeconds: 60, startedAtMs: 0, exercisesAttempted: 1, acceptedKeystrokes: 10, rejectedKeystrokes: 0, mistakes: [] }),
    ).toThrow()
  })
})

describe('appendExercises', () => {
  it('extends a running session without resetting the current exercise', () => {
    let state = startLessonSession([{ id: 'e1', targetText: '가' }])
    state = pressKey(state, 'KeyR', false)

    const appended = appendExercises(state, [{ id: 'e2', targetText: '나' }])

    expect(appended.exercises.map(({ id }) => id)).toEqual(['e1', 'e2'])
    expect(appended.currentIndex).toBe(0)
    expect(appended.currentSession).toBe(state.currentSession)
    expect(appended.startedAt).toBe(state.startedAt)
    expect(appended.status).toBe('typing')
  })

  it('moves a completed session straight to the first appended exercise', () => {
    let state = startLessonSession([{ id: 'e1', targetText: '가' }])
    state = pressKey(state, 'KeyR', false)
    state = pressKey(state, 'KeyK', false)
    expect(state.status).toBe('completed')

    const appended = appendExercises(state, [{ id: 'e2', targetText: '나' }])

    expect(appended.status).toBe('typing')
    expect(appended.currentIndex).toBe(1)
    expect(appended.currentSession.targetText).toBe('나')
    expect(appended.completedResults).toBe(state.completedResults)
  })

  it('starts an empty session on the first appended exercise', () => {
    const appended = appendExercises(startLessonSession([]), [{ id: 'e1', targetText: '가' }])

    expect(appended.status).toBe('typing')
    expect(appended.currentIndex).toBe(0)
    expect(appended.currentSession.targetText).toBe('가')
  })

  it('returns the same state when nothing is appended', () => {
    const state = startLessonSession([{ id: 'e1', targetText: '가' }])
    expect(appendExercises(state, [])).toBe(state)
  })
})

describe('compactLessonSession', () => {
  it('drops finished exercises and their results but keeps the current exercise', () => {
    let state = startLessonSession([
      { id: 'e1', targetText: '가' },
      { id: 'e2', targetText: '나' },
    ])
    state = pressKey(state, 'KeyR', false)
    state = pressKey(state, 'KeyK', false)
    state = pressKey(state, 'KeyS', false)

    const compacted = compactLessonSession(state)

    expect(compacted.exercises.map(({ id }) => id)).toEqual(['e2'])
    expect(compacted.currentIndex).toBe(0)
    expect(compacted.currentSession).toBe(state.currentSession)
    expect(compacted.completedResults).toEqual([])
    expect(compacted.lastCompletedExercise).toBeNull()
  })

  it('keeps the last exercise of a completed session so more can be appended', () => {
    let state = startLessonSession([{ id: 'e1', targetText: '가' }])
    state = pressKey(state, 'KeyR', false)
    state = pressKey(state, 'KeyK', false)

    const compacted = compactLessonSession(state)
    expect(compacted.exercises.map(({ id }) => id)).toEqual(['e1'])
    expect(compacted.status).toBe('completed')

    const appended = appendExercises(compacted, [{ id: 'e2', targetText: '나' }])
    expect(appended.currentIndex).toBe(1)
    expect(appended.currentSession.targetText).toBe('나')
  })
})
