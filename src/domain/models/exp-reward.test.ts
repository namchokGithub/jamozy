import { describe, expect, it } from 'vitest'
import { exerciseRewardExp, sessionRewardExp } from './exp-reward'

describe('exerciseRewardExp', () => {
  it('rewards a first completion by difficulty', () => {
    expect(
      exerciseRewardExp({ difficulty: 'easy', kind: 'first-completion' }),
    ).toBe(15)
    expect(
      exerciseRewardExp({ difficulty: 'medium', kind: 'first-completion' }),
    ).toBe(25)
    expect(
      exerciseRewardExp({ difficulty: 'hard', kind: 'first-completion' }),
    ).toBe(30)
  })

  it('rewards practice by difficulty', () => {
    expect(exerciseRewardExp({ difficulty: 'easy', kind: 'practice' })).toBe(3)
    expect(exerciseRewardExp({ difficulty: 'medium', kind: 'practice' })).toBe(
      5,
    )
    expect(exerciseRewardExp({ difficulty: 'hard', kind: 'practice' })).toBe(10)
  })

  it('counts a missing difficulty as easy', () => {
    expect(exerciseRewardExp({ kind: 'first-completion' })).toBe(15)
    expect(exerciseRewardExp({ kind: 'practice' })).toBe(3)
  })

  it('adds the perfect bonus only on a first completion', () => {
    expect(
      exerciseRewardExp({
        difficulty: 'hard',
        kind: 'first-completion',
        perfect: true,
      }),
    ).toBe(35)
    expect(
      exerciseRewardExp({
        difficulty: 'hard',
        kind: 'practice',
        perfect: true,
      }),
    ).toBe(10)
  })

  it('adds flat bonuses before percentage bonuses and rounds once', () => {
    expect(
      exerciseRewardExp(
        { difficulty: 'hard', kind: 'first-completion' },
        { flat: 13, percent: 0.2 },
      ),
    ).toBe(52)
  })
})

describe('sessionRewardExp', () => {
  it('sums the rounded exercise rewards', () => {
    expect(
      sessionRewardExp([
        { difficulty: 'easy', kind: 'first-completion', perfect: true },
        { difficulty: 'medium', kind: 'first-completion' },
        { difficulty: 'hard', kind: 'practice' },
      ]),
    ).toBe(55)
    expect(sessionRewardExp([])).toBe(0)
  })
})
