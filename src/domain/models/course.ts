import type { ContentStatusFields } from './content-status'

export type CourseType = 'learning' | 'home'

export interface Course extends ContentStatusFields {
  id: string
  title: string
  description: string
  order: number
  // Absent on courses created before DEC-043; read through courseType().
  type?: CourseType
  // Descendant counts over every status, kept by the persistence adapter;
  // absent until backfilled. Read through courseCounts().
  unitCount?: number
  lessonCount?: number
  exerciseCount?: number
  createdAt: Date
  updatedAt: Date
}

export function courseType(course: Pick<Course, 'type'>): CourseType {
  return course.type ?? 'learning'
}

export interface CourseCounts {
  units: number
  lessons: number
  exercises: number
}

export function courseCounts(
  course: Pick<Course, 'unitCount' | 'lessonCount' | 'exerciseCount'>,
): CourseCounts {
  return {
    units: course.unitCount ?? 0,
    lessons: course.lessonCount ?? 0,
    exercises: course.exerciseCount ?? 0,
  }
}
