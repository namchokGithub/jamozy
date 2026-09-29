import type { ContentStatusFields } from './content-status'

export interface Course extends ContentStatusFields {
  id: string
  title: string
  description: string
  order: number
  createdAt: Date
  updatedAt: Date
}
