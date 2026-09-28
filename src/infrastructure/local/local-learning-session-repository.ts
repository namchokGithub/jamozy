import type { LearningSession } from '../../domain/models/learning-session'
import type { LearningSessionRepository } from '../../domain/repositories/learning-session-repository'
import { GuestDatabase, guestDatabase } from './guest-database'

const key = (userId: string, sessionId: string) => `${userId}:${sessionId}`
export class LocalLearningSessionRepository implements LearningSessionRepository {
  constructor(private database: GuestDatabase = guestDatabase) {}
  getLearningSession(userId: string, sessionId: string) { return this.database.get<LearningSession>('learningSessions', key(userId, sessionId)) }
  async saveLearningSession(userId: string, session: LearningSession) { await this.database.put('learningSessions', key(userId, session.id), session) }
}
