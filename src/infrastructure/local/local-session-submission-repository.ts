import { aggregateFromSession, type SessionAggregate } from '../../domain/models/session-aggregate'
import type { LearningSession } from '../../domain/models/learning-session'
import type { SessionSubmissionEffects, SessionSubmissionOutcome, SessionSubmissionRepository } from '../../domain/repositories/session-submission-repository'
import { GuestDatabase, guestDatabase } from './guest-database'

const key = (userId: string, sessionId: string) => `${userId}:${sessionId}`
export class LocalSessionSubmissionRepository implements SessionSubmissionRepository {
  constructor(private database: GuestDatabase = guestDatabase) {}
  async submit(userId: string, session: LearningSession, effects: SessionSubmissionEffects): Promise<SessionSubmissionOutcome> {
    const aggregate: SessionAggregate = aggregateFromSession(session)
    const outcome = { session, aggregate, effects, wasDuplicate: false }
    const stored = await this.database.putSessionOnce(key(userId, session.id), session, outcome, effects)
    return stored.inserted ? outcome : { ...stored.outcome, wasDuplicate: true }
  }
}
