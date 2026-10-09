import { doc, runTransaction, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { addSessionAggregate, aggregateFromSession, emptySessionAggregate, type SessionAggregate } from '../../../domain/models/session-aggregate'
import type { LearningSession } from '../../../domain/models/learning-session'
import type { SessionSubmissionEffects, SessionSubmissionOutcome, SessionSubmissionRepository } from '../../../domain/repositories/session-submission-repository'
import { readSessionStatsWrites } from './firestore-player-stats'

type FirebaseSessionSubmissionDependencies = {
  db: typeof db
  doc: typeof doc
  runTransaction: typeof runTransaction
}
const firebaseDependencies: FirebaseSessionSubmissionDependencies = { db, doc, runTransaction }

function readOutcome(data: Record<string, unknown>): SessionSubmissionOutcome {
  const raw = data.session as Record<string, unknown>
  return { wasDuplicate: false, aggregate: data.aggregate as SessionAggregate, effects: (data.effects as SessionSubmissionOutcome['effects'] | undefined) ?? { progress: [], reviewItems: [] }, session: { ...raw, startedAt: (raw.startedAt as Timestamp).toDate(), completedAt: (raw.completedAt as Timestamp).toDate() } as LearningSession }
}
export class FirebaseSessionSubmissionRepository implements SessionSubmissionRepository {
  constructor(private dependencies: FirebaseSessionSubmissionDependencies = firebaseDependencies) {}

  async submit(userId: string, session: LearningSession, effects: SessionSubmissionEffects): Promise<SessionSubmissionOutcome> {
    const { db, doc, runTransaction } = this.dependencies
    return runTransaction(db, async (transaction) => {
      const receipt = doc(db, 'users', userId, 'sessionOutcomes', session.id)
      const existing = await transaction.get(receipt)
      if (existing.exists()) return { ...readOutcome(existing.data()), wasDuplicate: true }
      const outcome: SessionSubmissionOutcome = { session, aggregate: aggregateFromSession(session), effects, wasDuplicate: false }
      const profile = doc(db, 'users', userId)
      const profileData = await transaction.get(profile)
      const profileValues = profileData.data()
      const current = (profileValues?.sessionAggregate as SessionAggregate | undefined) ?? emptySessionAggregate()
      const writeStats = await readSessionStatsWrites(
        { db, doc },
        transaction,
        userId,
        profileValues,
        session,
      )
      transaction.set(doc(db, 'users', userId, 'learningSessions', session.id), { ...session, startedAt: session.startedAt, completedAt: session.completedAt })
      transaction.set(receipt, outcome)
      const profileUpdate: Record<string, unknown> = {
        sessionAggregate: addSessionAggregate(current, outcome.aggregate),
        ...writeStats(transaction),
      }
      if (!profileValues?.legacyBaseline && profileValues?.stats) {
        profileUpdate.legacyBaseline = { exp: profileValues.exp ?? 0, stats: profileValues.stats }
      }
      transaction.set(profile, profileUpdate, { merge: true })
      for (const progress of effects.progress) {
        transaction.set(doc(db, 'users', userId, 'lessonProgress', progress.lessonId), progress)
      }
      for (const reviewItem of effects.reviewItems) {
        transaction.set(doc(db, 'users', userId, 'reviewItems', reviewItem.id), reviewItem)
      }
      return outcome
    })
  }
}
