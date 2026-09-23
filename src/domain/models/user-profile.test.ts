import { describe, expect, it } from 'vitest'
import { levelFromExp } from './user-profile'

describe('levelFromExp', () => {
  it('starts at level 1 with no exp', () => {
    expect(levelFromExp(0)).toBe(1)
  })

  it('levels up every 100 exp', () => {
    expect(levelFromExp(99)).toBe(1)
    expect(levelFromExp(100)).toBe(2)
    expect(levelFromExp(250)).toBe(3)
  })
})
