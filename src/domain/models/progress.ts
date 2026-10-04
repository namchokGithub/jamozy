export type LessonProgressStatus = 'unlocked' | 'completed'

export interface Progress {
  lessonId: string
  status: LessonProgressStatus
  bestAccuracy: number
  bestSpeedWpm: number
  attempts: number
  lastAttemptAt: Date | null
  completedAt: Date | null
}
