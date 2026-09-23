import type { Progress } from '../models/progress'

export interface ProgressRepository {
  getProgress(userId: string, lessonId: string): Promise<Progress | null>
  getAllProgress(userId: string): Promise<Progress[]>
  saveProgress(userId: string, progress: Progress): Promise<void>
}
