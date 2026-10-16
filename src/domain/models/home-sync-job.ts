import type { ExerciseResult } from '../korean/lesson-session'
import type { ExerciseStat } from './player-stats'
import type { ExerciseDifficulty, LessonType } from './lesson'
import type { JamoCounts } from './jamo-stat'

export interface HomeSessionTotals {
  startedAtMs: number
  durationSeconds: number
  exercisesAttempted: number
  acceptedKeystrokes: number
  rejectedKeystrokes: number
  exercises?: ExerciseStat[]
  jamoCounts?: JamoCounts
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
        lesson: {
          id: string
          type?: LessonType
          // Absent on jobs queued before DEC-045 shipped.
          exercises: Array<{ id: string; difficulty?: ExerciseDifficulty }>
        }
        result: ExerciseResult
        submissionId: string
      }
    | {
        kind: 'replay'
        lessonId: string
        sessionId: string
        totals: HomeSessionTotals
        lessonType?: LessonType
        // Absent on jobs queued before DEC-046 shipped.
        difficulties?: ExerciseDifficulty[]
      }
  )
