import { describe, expect, it } from 'vitest'
import { courseCounts, courseType } from './course'

describe('courseType', () => {
  it('reads an absent type as learning', () => {
    expect(courseType({})).toBe('learning')
  })

  it('returns an explicit type', () => {
    expect(courseType({ type: 'home' })).toBe('home')
    expect(courseType({ type: 'learning' })).toBe('learning')
  })
})

describe('courseCounts', () => {
  it('reads absent counters as zero', () => {
    expect(courseCounts({})).toEqual({ units: 0, lessons: 0, exercises: 0 })
  })

  it('returns stored counters', () => {
    expect(
      courseCounts({ unitCount: 2, lessonCount: 5, exerciseCount: 40 }),
    ).toEqual({ units: 2, lessons: 5, exercises: 40 })
  })
})
