import { describe, expect, it } from 'vitest'
import { toProgress, toProgressDoc } from './progress-mapper'
import type { Progress } from '../../../domain/models/progress'

const base: Progress = {
  lessonId: 'lesson-1',
  status: 'unlocked',
  bestAccuracy: 0,
  bestSpeedWpm: 0,
  attempts: 0,
  lastAttemptAt: new Date('2026-10-06T00:00:00.000Z'),
  completedAt: null,
}

describe('progress mapper', () => {
  it('round-trips Home exercise progress (DEC-043)', () => {
    const progress: Progress = {
      ...base,
      completedExerciseIds: ['e1', 'e2'],
      homePartialResult: {
        submissionId: 's1',
        startedAtMs: 1,
        acceptedKeystrokes: 8,
        rejectedKeystrokes: 1,
      },
    }

    expect(toProgress('lesson-1', toProgressDoc(progress))).toEqual(progress)
  })

  it('writes no undefined Home fields for Learning Path progress', () => {
    const data = toProgressDoc(base)

    expect(data).not.toHaveProperty('completedExerciseIds')
    expect(data).not.toHaveProperty('homePartialResult')
    expect(toProgress('lesson-1', data)).toEqual(base)
  })
})
