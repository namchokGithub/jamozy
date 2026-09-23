export interface ReviewItem {
  id: string
  sourceLessonId: string
  sourceExerciseId: string
  targetText: string
  mistakeCount: number
  lastMistakeAt: Date
  resolved: boolean
  box: number
  nextReviewAt: Date
}

const LEITNER_INTERVAL_DAYS: Record<number, number> = {
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30,
}

const MAX_BOX = 5

export function nextBox(currentBox: number, wasCorrect: boolean): number {
  return wasCorrect ? Math.min(currentBox + 1, MAX_BOX) : 1
}

export function nextReviewDate(box: number, from: Date = new Date()): Date {
  const days = LEITNER_INTERVAL_DAYS[box] ?? LEITNER_INTERVAL_DAYS[1]
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000)
}
