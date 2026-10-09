import { describe, expect, it } from 'vitest'
import { lessonRankings } from './lesson-rankings'
import type { Progress } from './progress'

const progress = (lessonId: string, overrides: Partial<Progress>): Progress => ({
  lessonId,
  status: 'completed',
  bestAccuracy: 0,
  bestSpeedWpm: 0,
  attempts: 1,
  lastAttemptAt: null,
  completedAt: null,
  ...overrides,
})

describe('lessonRankings', () => {
  it('uses completed lessons only', () => {
    const rankings = lessonRankings([
      progress('a', { bestAccuracy: 92, attempts: 4 }),
      progress('b', { bestAccuracy: 99, attempts: 2 }),
      progress('c', { status: 'unlocked', bestAccuracy: 100, attempts: 9 }),
    ])
    expect(rankings).toEqual({
      bestAccuracy: { lessonId: 'b', bestAccuracy: 99 },
      mostReplayed: { lessonId: 'a', replays: 3 },
    })
  })

  it('returns null without completed lessons or replays', () => {
    expect(
      lessonRankings([progress('a', { attempts: 1 })]).mostReplayed,
    ).toBeNull()
    expect(lessonRankings([])).toEqual({
      bestAccuracy: null,
      mostReplayed: null,
    })
  })
})
