import type { ContentStatusFields } from './content-status'

export interface Unit extends ContentStatusFields {
  id: string
  courseId: string
  title: string
  description: string
  order: number
  createdAt: Date
  updatedAt: Date
}
