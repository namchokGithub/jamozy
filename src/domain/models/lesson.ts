export type LessonType =
  'character' | 'syllable' | 'word' | 'phrase' | 'sentence'

export type ExerciseDifficulty = 'easy' | 'medium' | 'hard'

import type { ContentStatusFields } from './content-status'

export interface LessonExercise {
  id: string
  targetText: string
  romanization: string | null
  meaningTh: string
  meaningEn: string
  difficulty: ExerciseDifficulty
  hint: string | null
}

export interface Lesson extends ContentStatusFields {
  id: string
  unitId: string
  title: string
  type: LessonType
  order: number
  exercises: LessonExercise[]
  // Stored copy of exercises.length so parents can be counted without
  // reading Exercises; the persistence adapter keeps it equal.
  exerciseCount?: number
  createdAt: Date
  updatedAt: Date
}

/** Stored Exercise count (DEC-047), or the loaded Exercises before it exists. */
export function lessonExerciseCount(
  lesson: Pick<Lesson, 'exerciseCount' | 'exercises'>,
): number {
  return lesson.exerciseCount ?? lesson.exercises.length
}
