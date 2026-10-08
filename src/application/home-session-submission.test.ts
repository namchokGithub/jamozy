import { describe, expect, it } from 'vitest'
import { submitHomeSession } from './home-session-submission'
import {
  FakeSessionSubmissionRepository,
  FakeUserProfileRepository,
} from '../test/fakes'
import { defaultUserProfile } from '../domain/models/user-profile'
import { emptySessionAggregate } from '../domain/models/session-aggregate'
import type { Progress } from '../domain/models/progress'

const now = new Date('2026-01-01')
const progress: Progress = {
  lessonId: 'l1',
  status: 'unlocked',
  bestAccuracy: 100,
  bestSpeedWpm: 20,
  attempts: 1,
  lastAttemptAt: now,
  completedAt: null,
}
const input = {
  sessionId: 's1',
  lessonId: 'l1',
  totals: {
    startedAtMs: 0,
    durationSeconds: 30,
    exercisesAttempted: 1,
    acceptedKeystrokes: 2,
    rejectedKeystrokes: 0,
  },
  expGained: 170,
  progress,
  now,
}

describe('submitHomeSession', () => {
  it('derives the outcome level from legacy and session-tracked EXP', async () => {
    const deps = {
      userProfileRepo: new FakeUserProfileRepository(),
      sessionSubmissionRepo: new FakeSessionSubmissionRepository(),
    }
    const profile = defaultUserProfile('user1', now)
    await deps.userProfileRepo.saveUserProfile('user1', {
      ...profile,
      sessionAggregate: { ...emptySessionAggregate(), exp: 630 },
    })

    const first = await submitHomeSession(deps, 'user1', input)
    // The adapter has already added the first submission to the aggregate.
    await deps.userProfileRepo.saveUserProfile('user1', {
      ...profile,
      sessionAggregate: { ...emptySessionAggregate(), exp: 800 },
    })
    const retry = await submitHomeSession(deps, 'user1', input)

    expect(first.level).toBe(5)
    expect(retry.level).toBe(5)
  })
})
