import { doc, getDoc, type Firestore, type Transaction } from 'firebase/firestore'
import { db } from '../firebase'
import type { JamoStatsRepository } from '../../../domain/repositories/jamo-stats-repository'
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

/** Stored jamo stats with Firestore Timestamps converted to Dates. */
export function toJamoStats(stored: unknown): JamoStats {
  return Object.fromEntries(
    Object.entries((stored ?? {}) as Record<string, StoredJamoStat>).map(
      ([jamo, stat]) => [
        jamo,
        {
          ...stat,
          firstPracticedAt: stat.firstPracticedAt.toDate(),
          lastPracticedAt: stat.lastPracticedAt.toDate(),
        },
      ],
    ),
  )
}

// Jamo stats (DEC-050) inside a submit transaction: read first, then the
// returned writer sets the whole map doc after the caller's other writes.
export async function readJamoStatsWrite(
  deps: { db: Firestore; doc: typeof doc },
  transaction: StatsTransaction,
  userId: string,
  counts: JamoCounts | undefined,
  now: Date,
): Promise<(writer: StatsTransaction) => void> {
  if (!counts || Object.keys(counts).length === 0) return () => {}
  const ref = deps.doc(deps.db, 'users', userId, 'learnerStats', 'jamo')
  const snapshot = await transaction.get(ref)
  const current = toJamoStats(snapshot.exists() ? snapshot.data().jamo : undefined)
  const next = applyJamoCounts(current, counts, now)
  return (writer) => {
    writer.set(ref, { jamo: next })
  }
}

export class FirebaseJamoStatsRepository implements JamoStatsRepository {
  constructor(private readonly firestore: Firestore = db) {}

  async getJamoStats(userId: string): Promise<JamoStats> {
    const snapshot = await getDoc(
      doc(this.firestore, 'users', userId, 'learnerStats', 'jamo'),
    )
    return snapshot.exists() ? toJamoStats(snapshot.data().jamo) : {}
  }
}
