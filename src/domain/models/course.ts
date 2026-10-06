import type { ContentStatusFields } from './content-status'

export type CourseType = 'learning' | 'home'

export interface Course extends ContentStatusFields {
  id: string
  title: string
  description: string
  order: number
  // Absent on courses created before DEC-043; read through courseType().
  type?: CourseType
  createdAt: Date
  updatedAt: Date
}

export function courseType(course: Pick<Course, 'type'>): CourseType {
  return course.type ?? 'learning'
}
