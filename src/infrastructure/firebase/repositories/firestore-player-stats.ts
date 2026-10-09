import type { doc as docFn, Firestore, Transaction } from 'firebase/firestore'
import { applySessionStats, type PeriodStats, type PlayerStats } from '../../../domain/models/player-stats'
import type { LearningSession } from '../../../domain/models/learning-session'

type StatsTransaction = Pick<Transaction, 'get' | 'set'>

// Player stats (DEC-049) inside a submit or migration transaction. Reads
// first; the returned writer sets the day/month docs and returns the profile
// fields to merge, so callers keep Firestore's reads-before-writes rule.
export async function readSessionStatsWrites(
  deps: { db: Firestore; doc: typeof docFn },
  transaction: StatsTransaction,
  userId: string,
  profileData: Record<string, unknown> | undefined,
  session: LearningSession,
) {
  const { db, doc } = deps
  const profileTimeZone = typeof profileData?.timezone === 'string' ? profileData.timezone : undefined
  const preview = applySessionStats(
    { player: undefined, daily: null, monthly: null, profileTimeZone },
    session,
  )
  const dailyRef = doc(db, 'users', userId, 'dailyStats', preview.date)
  const monthlyRef = doc(db, 'users', userId, 'monthlyStats', preview.month)
  const [daily, monthly] = await Promise.all([transaction.get(dailyRef), transaction.get(monthlyRef)])
  const next = applySessionStats(
    {
      player: profileData?.playerStats as PlayerStats | undefined,
      daily: daily.exists() ? (daily.data() as PeriodStats) : null,
      monthly: monthly.exists() ? (monthly.data() as PeriodStats) : null,
      profileTimeZone,
    },
    session,
  )
  return (writer: StatsTransaction): Record<string, unknown> => {
    writer.set(dailyRef, next.daily)
    writer.set(monthlyRef, next.monthly)
    return {
      playerStats: next.player,
      ...(profileTimeZone || !session.timeZone ? {} : { timezone: session.timeZone }),
    }
  }
}
