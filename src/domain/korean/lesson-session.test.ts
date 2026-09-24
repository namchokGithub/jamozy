import { describe, expect, it } from 'vitest'
import {
  getLessonProgress,
  getLessonResult,
  pressKey,
  startLessonSession,
  lessonResultSchema,
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
      { exerciseId: 'e1', targetText: '가', correctKeyCount: 2, mistakes: [] },
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
    expect(result).toEqual({ accuracy: 0, speedWpm: 0, durationSeconds: 0, mistakes: [] })
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
      lessonResultSchema.parse({ accuracy: 90, speedWpm: 2, durationSeconds: 60, mistakes: [] }),
    ).not.toThrow()
  })

  it('rejects an out-of-range accuracy', () => {
    expect(() =>
      lessonResultSchema.parse({ accuracy: 150, speedWpm: 2, durationSeconds: 60, mistakes: [] }),
    ).toThrow()
  })
})
