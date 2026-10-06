import type { ExerciseResult } from '../korean/lesson-session'

export interface HomeSessionTotals {
  startedAtMs: number
  durationSeconds: number
  exercisesAttempted: number
  acceptedKeystrokes: number
  rejectedKeystrokes: number
}

interface HomeSyncJobBase {
  id: string
  userId: string
  // When the learner did the work; used as the write's timestamp.
  enqueuedAt: Date
  attempts: number
  nextAttemptAt: Date | null
}

// A Home write waiting in the durable outbox (DEC-043).
export type HomeSyncJob = HomeSyncJobBase &
  (
    | {
        kind: 'exercise'
        lesson: { id: string; exercises: Array<{ id: string }> }
        result: ExerciseResult
        submissionId: string
      }
    | {
        kind: 'replay'
        lessonId: string
        sessionId: string
        totals: HomeSessionTotals
      }
  )
