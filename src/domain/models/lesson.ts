export type LessonType = 'character' | 'syllable' | 'word' | 'phrase' | 'sentence'

export type ExerciseDifficulty = 'easy' | 'medium' | 'hard'

export interface LessonExercise {
  id: string
  targetText: string
  romanization: string | null
  meaningTh: string
  meaningEn: string
  difficulty: ExerciseDifficulty
  hint: string | null
}

export interface Lesson {
  id: string
  unitId: string
  title: string
  type: LessonType
  order: number
  exercises: LessonExercise[]
  createdAt: Date
  updatedAt: Date
}
