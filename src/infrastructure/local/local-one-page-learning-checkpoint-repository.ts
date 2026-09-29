import type { OnePageLearningCheckpoint } from '../../domain/models/one-page-learning-checkpoint'
import type { OnePageLearningCheckpointRepository } from '../../domain/repositories/one-page-learning-checkpoint-repository'
import { GuestDatabase, guestDatabase } from './guest-database'

const key = (userId: string, courseId: string) => `${userId}:${courseId}`

export class LocalOnePageLearningCheckpointRepository
  implements OnePageLearningCheckpointRepository
{
  constructor(private readonly database: GuestDatabase = guestDatabase) {}

  getCheckpoint(userId: string, courseId: string) {
    return this.database.get<OnePageLearningCheckpoint>(
      'onePageLearningCheckpoints',
      key(userId, courseId),
    )
  }

  async saveCheckpoint(checkpoint: OnePageLearningCheckpoint): Promise<void> {
    await this.database.put(
      'onePageLearningCheckpoints',
      key(checkpoint.userId, checkpoint.courseId),
      checkpoint,
    )
  }

  async clearLesson(
    userId: string,
    courseId: string,
    lessonId: string,
  ): Promise<void> {
    const checkpoint = await this.getCheckpoint(userId, courseId)
    if (!checkpoint) return
    const completedExerciseIdsByLesson = { ...checkpoint.completedExerciseIdsByLesson }
    const partialLessonResults = { ...checkpoint.partialLessonResults }
    delete completedExerciseIdsByLesson[lessonId]
    delete partialLessonResults[lessonId]
    if (
      Object.keys(completedExerciseIdsByLesson).length === 0 &&
      Object.keys(partialLessonResults).length === 0
    ) {
      await this.database.delete('onePageLearningCheckpoints', key(userId, courseId))
      return
    }
    await this.saveCheckpoint({
      ...checkpoint,
      completedExerciseIdsByLesson,
      partialLessonResults,
      updatedAt: new Date(),
    })
  }
}
