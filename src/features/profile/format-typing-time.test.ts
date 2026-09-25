import { describe, expect, it } from 'vitest'
import { formatTypingTime } from './format-typing-time'

describe('formatTypingTime', () => {
  it('formats 0 seconds as "0 min"', () => {
    expect(formatTypingTime(0)).toBe('0 min')
  })

  it('formats under a minute as "0 min"', () => {
    expect(formatTypingTime(45)).toBe('0 min')
  })

  it('formats whole minutes under an hour', () => {
    expect(formatTypingTime(125)).toBe('2 min')
  })

  it('formats hours and minutes', () => {
    expect(formatTypingTime(3665)).toBe('1h 1m')
  })

  it('omits a trailing "0m" on an exact hour', () => {
    expect(formatTypingTime(7200)).toBe('2h')
  })
})
