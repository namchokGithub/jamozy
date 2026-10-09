import { describe, expect, it } from 'vitest'
import type { LearningSession } from './learning-session'
import {
  applySessionStats,
  emptyPeriodStats,
  localDateIn,
  periodStatsFrom,
  sessionStatsFrom,
} from './player-stats'

const at = (iso: string) => new Date(iso)
const stat = (targetText: string, mistakeCount = 0) => ({
  targetText,
  mistakeCount,
  typingSeconds: 2,
  elapsedSeconds: 3,
})

function session(overrides: Partial<LearningSession> = {}): LearningSession {
  return {
    id: 's1',
    context: { mode: 'learning-path', lessonId: 'l1' },
    startedAt: at('2026-10-09T01:00:00Z'),
    completedAt: at('2026-10-09T01:05:00Z'),
    durationSeconds: 300,
    exercisesAttempted: 2,
    acceptedKeystrokes: 20,
    rejectedKeystrokes: 0,
    expGained: 25,
    localDate: '2026-10-09',
    typingSeconds: 60,
    charactersTyped: 4,
    wordsPracticed: 2,
    sentencesPracticed: 0,
    exerciseMistakes: [0, 0],
    ...overrides,
  }
}

const fresh = {
  player: undefined,
  daily: null,
  monthly: null,
  profileTimeZone: 'Asia/Bangkok',
}

describe('localDateIn', () => {
  it('uses the zone, not UTC, across midnight', () => {
    expect(localDateIn(at('2026-10-09T17:30:00Z'), 'Asia/Bangkok')).toBe('2026-10-10')
    expect(localDateIn(at('2026-10-09T17:30:00Z'), 'UTC')).toBe('2026-10-09')
  })
})

describe('sessionStatsFrom', () => {
  it('counts Hangul syllables without spaces and words for word lessons', () => {
    const stats = sessionStatsFrom(
      [stat('사과'), stat('안녕 하세요', 1)],
      'word',
      'Asia/Bangkok',
      at('2026-10-09T01:00:00Z'),
    )
    expect(stats).toEqual({
      localDate: '2026-10-09',
      timeZone: 'Asia/Bangkok',
      typingSeconds: 4,
      charactersTyped: 7,
      wordsPracticed: 2,
      sentencesPracticed: 0,
      exerciseMistakes: [0, 1],
    })
  })

  it('counts phrase and sentence lessons as sentences', () => {
    expect(sessionStatsFrom([stat('가')], 'phrase', 'UTC', at('2026-10-09T00:00:00Z')).sentencesPracticed).toBe(1)
  })

  it('uses per-exercise lesson types (review) and counts only characters when absent', () => {
    const stats = sessionStatsFrom(
      [{ ...stat('가'), lessonType: 'sentence' }, stat('나')],
      undefined,
      'UTC',
      at('2026-10-09T00:00:00Z'),
    )
    expect(stats).toMatchObject({ charactersTyped: 2, wordsPracticed: 0, sentencesPracticed: 1 })
  })
})

describe('periodStatsFrom', () => {
  it('maps a perfect first-time lesson', () => {
    expect(periodStatsFrom(session())).toEqual({
      ...emptyPeriodStats(),
      expEarned: 25,
      lessonsCompleted: 1,
      perfectLessons: 1,
      correctKeystrokes: 20,
      charactersTyped: 4,
      wordsPracticed: 2,
      typingSeconds: 60,
      learningSeconds: 300,
    })
  })

  it('counts a weak jamo practice only as a practice', () => {
    expect(
      periodStatsFrom(
        session({
          context: { mode: 'weak-jamo' },
          rejectedKeystrokes: 0,
          isReplay: true,
        }),
      ),
    ).toMatchObject({
      practicesCompleted: 1,
      lessonsCompleted: 0,
      lessonsReplayed: 0,
      perfectLessons: 0,
      reviewsCompleted: 0,
    })
    expect(periodStatsFrom(session()).practicesCompleted).toBe(0)
  })

  it('counts a replay as completed and replayed; a review as neither', () => {
    expect(periodStatsFrom(session({ isReplay: true }))).toMatchObject({ lessonsCompleted: 1, lessonsReplayed: 1 })
    expect(periodStatsFrom(session({ context: { mode: 'review' }, rejectedKeystrokes: 0 }))).toMatchObject({ lessonsCompleted: 0, reviewsCompleted: 1, perfectLessons: 0 })
  })

  it('prefers learningSeconds over durationSeconds', () => {
    expect(periodStatsFrom(session({ learningSeconds: 40 })).learningSeconds).toBe(40)
  })
})

describe('applySessionStats', () => {
  it('starts a streak and an active day on the first session', () => {
    const next = applySessionStats(fresh, session())
    expect(next).toMatchObject({ date: '2026-10-09', month: '2026-10' })
    expect(next.player).toMatchObject({
      activeDays: 1,
      streak: { current: 1, longest: 1, lastActiveDate: '2026-10-09' },
      perfectStreak: { current: 2, longest: 2 },
      records: {
        mostExpDay: { value: 25, period: '2026-10-09' },
        mostExpMonth: { value: 25, period: '2026-10' },
        mostLessonsDay: { value: 1, period: '2026-10-09' },
      },
    })
  })

  it('keeps the streak on the same day and adds to the daily doc', () => {
    const first = applySessionStats(fresh, session())
    const second = applySessionStats({ ...fresh, player: first.player, daily: first.daily, monthly: first.monthly }, session({ id: 's2' }))
    expect(second.player.activeDays).toBe(1)
    expect(second.player.streak.current).toBe(1)
    expect(second.daily.expEarned).toBe(50)
    expect(second.player.records.mostExpDay).toEqual({ value: 50, period: '2026-10-09' })
  })

  it('extends on the next day, resets after a gap, keeps the longest', () => {
    const one = applySessionStats(fresh, session())
    const two = applySessionStats({ ...fresh, player: one.player }, session({ localDate: '2026-10-10' }))
    expect(two.player.streak).toEqual({ current: 2, longest: 2, lastActiveDate: '2026-10-10' })
    const gap = applySessionStats({ ...fresh, player: two.player }, session({ localDate: '2026-10-13' }))
    expect(gap.player.streak).toEqual({ current: 1, longest: 2, lastActiveDate: '2026-10-13' })
  })

  it('adds a late session to its day without touching the streak', () => {
    const today = applySessionStats(fresh, session({ localDate: '2026-10-09' }))
    const late = applySessionStats({ ...fresh, player: today.player }, session({ localDate: '2026-10-05' }))
    expect(late.date).toBe('2026-10-05')
    expect(late.player.streak).toEqual(today.player.streak)
    expect(late.player.activeDays).toBe(2)
  })

  it('continues the perfect streak across sessions and resets on a mistake', () => {
    const one = applySessionStats(fresh, session({ exerciseMistakes: [0, 0] }))
    const two = applySessionStats({ ...fresh, player: one.player }, session({ exerciseMistakes: [0, 2, 0] }))
    expect(two.player.perfectStreak).toEqual({ current: 1, longest: 3 })
  })

  it('treats a session without stats fields as zero and dates it from completedAt', () => {
    const legacy = session({ localDate: undefined, typingSeconds: undefined, charactersTyped: undefined, wordsPracticed: undefined, sentencesPracticed: undefined, exerciseMistakes: undefined, completedAt: at('2026-10-09T17:30:00Z') })
    const next = applySessionStats(fresh, legacy)
    expect(next.date).toBe('2026-10-10')
    expect(next.daily.typingSeconds).toBe(0)
    expect(Number.isNaN(next.daily.charactersTyped)).toBe(false)
  })
})
