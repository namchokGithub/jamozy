import { describe, expect, it } from 'vitest'
import { lessonExerciseCount } from './lesson'

describe('lessonExerciseCount', () => {
  it('reads the stored counter', () => {
    expect(lessonExerciseCount({ exerciseCount: 12, exercises: [] })).toBe(12)
  })

  it('falls back to the loaded Exercises before the counter exists', () => {
    expect(lessonExerciseCount({ exercises: [{} as never, {} as never] })).toBe(
      2,
    )
  })
})
