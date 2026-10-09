import { describe, expect, it } from 'vitest'
import { addSessionAggregate, aggregateFromSession, emptySessionAggregate } from './session-aggregate'
import type { LearningSession } from './learning-session'

const base: LearningSession = {
  id: 's1', context: { mode: 'learning-path', lessonId: 'l1' }, startedAt: new Date(0), completedAt: new Date(300_000), durationSeconds: 300, exercisesAttempted: 2, acceptedKeystrokes: 50, rejectedKeystrokes: 0, expGained: 25, typingSeconds: 60, learningSeconds: 120, charactersTyped: 4, wordsPracticed: 2, sentencesPracticed: 0, isReplay: true,
}

describe('session aggregate stats', () => {
  it('derives the new counters from a session', () => {
    expect(aggregateFromSession(base)).toMatchObject({ lessonsCompleted: 1, lessonsReplayed: 1, reviewsCompleted: 0, perfectLessons: 1, charactersTyped: 4, wordsPracticed: 2, typingSeconds: 60, totalTypingTimeSeconds: 120, longestSessionSeconds: 120, bestWpm: 10 })
  })

  it('adds onto a legacy aggregate without the new fields', () => {
    const legacy = { exp: 5, exercisesAttempted: 1, acceptedKeystrokes: 1, rejectedKeystrokes: 0, totalTypingTimeSeconds: 9, bestAccuracy: 50 }
    const sum = addSessionAggregate(legacy, aggregateFromSession(base))
    expect(sum).toMatchObject({ lessonsCompleted: 1, typingSeconds: 60, bestWpm: 10, longestSessionSeconds: 120 })
    expect(Object.values(sum).some((value) => Number.isNaN(value))).toBe(false)
  })

  it('keeps the max for best WPM and the longest session', () => {
    const first = aggregateFromSession(base)
    const slower = aggregateFromSession({ ...base, typingSeconds: 600, learningSeconds: 30 })
    expect(addSessionAggregate(first, slower)).toMatchObject({ bestWpm: 10, longestSessionSeconds: 120 })
  })

  it('reports zero WPM when no typing time was measured', () => {
    expect(aggregateFromSession({ ...base, typingSeconds: undefined }).bestWpm).toBe(0)
    expect(emptySessionAggregate().bestWpm).toBe(0)
  })

  it('adds practicesCompleted onto an aggregate without it', () => {
    const legacy = { exp: 0, exercisesAttempted: 0, acceptedKeystrokes: 0, rejectedKeystrokes: 0, totalTypingTimeSeconds: 0, bestAccuracy: 0 }
    const practice = aggregateFromSession({ ...base, context: { mode: 'weak-jamo' } })
    expect(practice).toMatchObject({ practicesCompleted: 1, lessonsCompleted: 0 })
    expect(addSessionAggregate(legacy, practice).practicesCompleted).toBe(1)
  })
})
