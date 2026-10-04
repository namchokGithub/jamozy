export interface OnePagePartialLessonResult {
  submissionId: string
  startedAtMs: number
  acceptedKeystrokes: number
  rejectedKeystrokes: number
  completedExerciseIds: string[]
  mistakes: Array<{ sourceExerciseId: string; targetText: string }>
}

export interface OnePageLearningCheckpoint {
  userId: string
  courseId: string
  completedExerciseIdsByLesson: Record<string, string[]>
  partialLessonResults: Record<string, OnePagePartialLessonResult>
  updatedAt: Date
}
