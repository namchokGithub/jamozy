import type { LearningSession } from '../models/learning-session'

export interface LearningSessionRepository {
  getLearningSession(userId: string, sessionId: string): Promise<LearningSession | null>
  saveLearningSession(userId: string, session: LearningSession): Promise<void>
}
