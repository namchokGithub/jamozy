import { describe, expect, it } from 'vitest'
import { addSessionAggregate, aggregateFromSession, emptySessionAggregate } from './session-aggregate'

describe('aggregateFromSession', () => {
  it('counts an EXP-awarding learning-path session as one completed lesson', () => {
    const aggregate = aggregateFromSession({
      context: { mode: 'learning-path', lessonId: 'lesson-1' },
      expGained: 120,
      exercisesAttempted: 2,
      acceptedKeystrokes: 10,
      rejectedKeystrokes: 0,
      durationSeconds: 60,
    })

    expect(aggregate.lessonsCompleted).toBe(1)
  })

  it('does not count retries or non-learning sessions as completed lessons', () => {
    const retry = aggregateFromSession({
      context: { mode: 'learning-path', lessonId: 'lesson-1' },
      expGained: 0,
      exercisesAttempted: 2,
      acceptedKeystrokes: 10,
      rejectedKeystrokes: 0,
      durationSeconds: 60,
    })
    const review = aggregateFromSession({
      context: { mode: 'review' },
      expGained: 120,
      exercisesAttempted: 2,
      acceptedKeystrokes: 10,
      rejectedKeystrokes: 0,
      durationSeconds: 60,
    })

    expect(retry.lessonsCompleted).toBe(0)
    expect(review.lessonsCompleted).toBe(0)
  })

  it('adds a new completion to an aggregate stored before lesson counting existed', () => {
    const aggregate = addSessionAggregate(
      { ...emptySessionAggregate(), lessonsCompleted: undefined },
      { ...emptySessionAggregate(), lessonsCompleted: 1 },
    )

    expect(aggregate.lessonsCompleted).toBe(1)
  })
})
