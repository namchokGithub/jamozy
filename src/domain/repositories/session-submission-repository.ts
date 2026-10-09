import type { LearningSession } from '../models/learning-session'
import type { SessionAggregate } from '../models/session-aggregate'
import type { Progress } from '../models/progress'
import type { ReviewItem } from '../models/review-item'
import type { JamoCounts } from '../models/jamo-stat'

export interface SessionSubmissionEffects {
  progress: Progress[]
  reviewItems: ReviewItem[]
  // Key-level jamo counts (DEC-050); applied on submit, never migrated.
  jamoCounts?: JamoCounts
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
