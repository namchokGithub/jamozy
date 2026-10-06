import { describe, expect, it } from 'vitest'
import { courseType } from './course'

describe('courseType', () => {
  it('reads an absent type as learning', () => {
    expect(courseType({})).toBe('learning')
  })

  it('returns an explicit type', () => {
    expect(courseType({ type: 'home' })).toBe('home')
    expect(courseType({ type: 'learning' })).toBe('learning')
  })
})
