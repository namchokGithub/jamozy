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
  createdAt: Date
  updatedAt: Date
}
