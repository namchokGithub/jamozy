import type { ContentStatusFields } from './content-status'

export interface Unit extends ContentStatusFields {
  id: string
  courseId: string
  title: string
  description: string
  order: number
  // Descendant counts over every status, kept by the persistence adapter;
  // absent until backfilled. Read through unitCounts().
  lessonCount?: number
  exerciseCount?: number
  createdAt: Date
  updatedAt: Date
}

export interface UnitCounts {
  lessons: number
  exercises: number
}

export function unitCounts(
  unit: Pick<Unit, 'lessonCount' | 'exerciseCount'>,
): UnitCounts {
  return {
    lessons: unit.lessonCount ?? 0,
    exercises: unit.exerciseCount ?? 0,
  }
}
