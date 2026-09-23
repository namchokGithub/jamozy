import type { ProgressRepository } from '../domain/repositories/progress-repository'
import type { Progress } from '../domain/models/progress'

export interface AttemptResult {
  accuracy: number
  speedWpm: number
}

export async function updateProgress(
  progressRepo: ProgressRepository,
  userId: string,
  lessonId: string,
  attempt: AttemptResult,
  now: Date = new Date(),
): Promise<Progress> {
  const existing = await progressRepo.getProgress(userId, lessonId)

  const progress: Progress = {
    lessonId,
    status: existing?.status ?? 'unlocked',
    bestAccuracy: Math.max(existing?.bestAccuracy ?? 0, attempt.accuracy),
    bestSpeedWpm: Math.max(existing?.bestSpeedWpm ?? 0, attempt.speedWpm),
    attempts: (existing?.attempts ?? 0) + 1,
    lastAttemptAt: now,
    completedAt: existing?.completedAt ?? null,
  }

  await progressRepo.saveProgress(userId, progress)
  return progress
}
