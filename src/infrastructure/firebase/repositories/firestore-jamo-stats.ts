import type { doc as docFn, Firestore, Transaction } from 'firebase/firestore'
import {
  applyJamoCounts,
  type JamoCounts,
  type JamoStat,
  type JamoStats,
} from '../../../domain/models/jamo-stat'

type StatsTransaction = Pick<Transaction, 'get' | 'set'>
type StoredJamoStat = Omit<JamoStat, 'firstPracticedAt' | 'lastPracticedAt'> & {
  firstPracticedAt: { toDate(): Date }
  lastPracticedAt: { toDate(): Date }
}

// Jamo stats (DEC-050) inside a submit transaction: read first, then the
// returned writer sets the whole map doc after the caller's other writes.
export async function readJamoStatsWrite(
  deps: { db: Firestore; doc: typeof docFn },
  transaction: StatsTransaction,
  userId: string,
  counts: JamoCounts | undefined,
  now: Date,
): Promise<(writer: StatsTransaction) => void> {
  if (!counts || Object.keys(counts).length === 0) return () => {}
  const ref = deps.doc(deps.db, 'users', userId, 'learnerStats', 'jamo')
  const snapshot = await transaction.get(ref)
  const stored = (snapshot.exists() ? snapshot.data().jamo : undefined) as
    | Record<string, StoredJamoStat>
    | undefined
  const current: JamoStats = Object.fromEntries(
    Object.entries(stored ?? {}).map(([jamo, stat]) => [
      jamo,
      {
        ...stat,
        firstPracticedAt: stat.firstPracticedAt.toDate(),
        lastPracticedAt: stat.lastPracticedAt.toDate(),
      },
    ]),
  )
  const next = applyJamoCounts(current, counts, now)
  return (writer) => {
    writer.set(ref, { jamo: next })
  }
}
