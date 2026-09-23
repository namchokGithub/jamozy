export interface ReviewItem {
  id: string
  sourceLessonId: string
  sourceExerciseId: string
  targetText: string
  mistakeCount: number
  lastMistakeAt: Date
  resolved: boolean
}
