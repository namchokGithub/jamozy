import { describe, expect, it } from 'vitest'
import { unitCounts } from './unit'

describe('unitCounts', () => {
  it('reads absent counters as zero', () => {
    expect(unitCounts({})).toEqual({ lessons: 0, exercises: 0 })
  })

  it('returns stored counters', () => {
    expect(unitCounts({ lessonCount: 3, exerciseCount: 24 })).toEqual({
      lessons: 3,
      exercises: 24,
    })
  })
})
