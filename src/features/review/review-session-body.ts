import type {
  ExerciseResult,
  LessonResult,
} from '../../domain/korean/lesson-session'

// Kept out of ReviewTypingSession.tsx so that file exports only a component
// (Fast Refresh).
export interface CompletedTypingSession {
  submissionId: string
  metrics: LessonResult
  results: ExerciseResult[]
}

// The Review request body: one result per Review item (`itemId`).
export function reviewSessionBody({
  submissionId,
  metrics,
  results,
}: CompletedTypingSession): Record<string, unknown> {
  return {
    submissionId,
    durationSeconds: metrics.durationSeconds,
    startedAtMs: metrics.startedAtMs,
    exercisesAttempted: metrics.exercisesAttempted,
    acceptedKeystrokes: metrics.acceptedKeystrokes,
    rejectedKeystrokes: metrics.rejectedKeystrokes,
    ...(metrics.jamoCounts ? { jamoCounts: metrics.jamoCounts } : {}),
    results: results.map((result) => ({
      itemId: result.exerciseId,
      wasCorrect: result.mistakes.length === 0,
      mistakeCount: result.mistakes.length,
      typingSeconds: result.typingSeconds ?? 0,
      elapsedSeconds: result.elapsedSeconds ?? 0,
    })),
  }
}
