import { describe, expect, it } from 'vitest'
import { guestStatsWrites } from './guest-database'
import { defaultUserProfile } from '../../domain/models/user-profile'

const session = {
  id: 's1', context: { mode: 'review' as const }, startedAt: new Date('2026-10-09T01:00:00Z'), completedAt: new Date('2026-10-09T01:01:00Z'), durationSeconds: 60, exercisesAttempted: 1, acceptedKeystrokes: 5, rejectedKeystrokes: 1, expGained: 0, localDate: '2026-10-09', timeZone: 'Asia/Bangkok', exerciseMistakes: [1],
}

describe('guestStatsWrites', () => {
  it('fills the timezone once and counts a review day', () => {
    const profile = defaultUserProfile('guest-1', new Date(0))
    const writes = guestStatsWrites(profile, null, null, session)
    expect(writes.profile.timezone).toBe('Asia/Bangkok')
    expect(writes.daily).toMatchObject({ reviewsCompleted: 1, incorrectKeystrokes: 1 })
    expect(writes.profile.playerStats).toMatchObject({ activeDays: 1, perfectStreak: { current: 0 } })
    const kept = guestStatsWrites({ ...profile, timezone: 'Asia/Seoul' }, writes.daily, writes.monthly, session)
    expect(kept.profile.timezone).toBe('Asia/Seoul')
  })
})
