import type { LearningSession } from '../models/learning-session'
import type { SessionAggregate } from '../models/session-aggregate'
import type { Progress } from '../models/progress'
import type { ReviewItem } from '../models/review-item'

export interface SessionSubmissionEffects {
  progress: Progress[]
  reviewItems: ReviewItem[]
}
export interface SessionSubmissionOutcome {
  session: LearningSession
  aggregate: SessionAggregate
  effects: SessionSubmissionEffects
  wasDuplicate: boolean
}
export interface SessionSubmissionRepository {
  submit(
    userId: string,
    session: LearningSession,
    effects: SessionSubmissionEffects,
  ): Promise<SessionSubmissionOutcome>
}
