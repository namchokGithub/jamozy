import type { OnePageLearningCheckpoint } from '../models/one-page-learning-checkpoint'

export interface OnePageLearningCheckpointRepository {
  getCheckpoint(
    userId: string,
    courseId: string,
  ): Promise<OnePageLearningCheckpoint | null>
  saveCheckpoint(checkpoint: OnePageLearningCheckpoint): Promise<void>
  clearLesson(userId: string, courseId: string, lessonId: string): Promise<void>
}
