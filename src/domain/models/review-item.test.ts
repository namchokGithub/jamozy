import { describe, expect, it } from 'vitest'
import { nextBox, nextReviewDate } from './review-item'

describe('nextBox', () => {
  it('advances by one on a correct answer', () => {
    expect(nextBox(2, true)).toBe(3)
  })

  it('caps at box 5', () => {
    expect(nextBox(5, true)).toBe(5)
  })

  it('resets to box 1 on a mistake', () => {
    expect(nextBox(4, false)).toBe(1)
  })
})

describe('nextReviewDate', () => {
  it('schedules box 1 one day out', () => {
    const from = new Date('2026-01-01T00:00:00.000Z')
    expect(nextReviewDate(1, from)).toEqual(new Date('2026-01-02T00:00:00.000Z'))
  })

  it('schedules box 5 thirty days out', () => {
    const from = new Date('2026-01-01T00:00:00.000Z')
    expect(nextReviewDate(5, from)).toEqual(new Date('2026-01-31T00:00:00.000Z'))
  })
})
