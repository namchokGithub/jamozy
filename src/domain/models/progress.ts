export type LessonProgressStatus = 'unlocked' | 'completed'

// Raw totals of a Home lesson's first exercise completions, kept until the
// lesson first completes (DEC-043).
export interface HomePartialResult {
  submissionId: string
  startedAtMs: number
  acceptedKeystrokes: number
  rejectedKeystrokes: number
}

export interface Progress {
  lessonId: string
  status: LessonProgressStatus
  bestAccuracy: number
  bestSpeedWpm: number
  attempts: number
  lastAttemptAt: Date | null
  completedAt: Date | null
  // Home lessons only (DEC-043).
  completedExerciseIds?: string[]
  homePartialResult?: HomePartialResult
}
