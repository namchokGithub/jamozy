import type { CourseRepository } from '../domain/repositories/course-repository'
import type { LessonRepository } from '../domain/repositories/lesson-repository'
import type { ProgressRepository } from '../domain/repositories/progress-repository'
import type { UserProfileRepository } from '../domain/repositories/user-profile-repository'
import type { Progress } from '../domain/models/progress'
import { defaultUserProfile, levelFromExp, type UserProfile } from '../domain/models/user-profile'
import { updateProgress, type AttemptResult } from './update-progress'
import { findContiguousFrontier, getOrderedLearningPath } from './learning-path-order'

export interface CompleteLessonDeps {
  courseRepo: CourseRepository
  lessonRepo: LessonRepository
  progressRepo: ProgressRepository
  userProfileRepo: UserProfileRepository
}

export interface LessonCompletionResult extends AttemptResult {
  durationSeconds: number
}

export interface CompleteLessonOutcome {
  progress: Progress
  expGained: number
  level: number
  unlockedNextLessonId: string | null
}

function calculateExpGained(accuracy: number): number {
  let exp = 100
  if (accuracy > 90) exp += 20
  if (accuracy === 100) exp += 50
  return exp
}

async function unlockLesson(
  deps: CompleteLessonDeps,
  userId: string,
  lessonId: string,
): Promise<void> {
  const existing = await deps.progressRepo.getProgress(userId, lessonId)
  if (existing) return

  await deps.progressRepo.saveProgress(userId, {
    lessonId,
    status: 'unlocked',
    bestAccuracy: 0,
    bestSpeedWpm: 0,
    attempts: 0,
    lastAttemptAt: null,
    completedAt: null,
  })
}

export async function completeLesson(
  deps: CompleteLessonDeps,
  userId: string,
  lessonId: string,
  result: LessonCompletionResult,
  now: Date = new Date(),
): Promise<CompleteLessonOutcome> {
  const wasAlreadyCompleted =
    (await deps.progressRepo.getProgress(userId, lessonId))?.status ===
    'completed'

  const progress = await updateProgress(
    deps.progressRepo,
    userId,
    lessonId,
    result,
    now,
  )

  if (wasAlreadyCompleted) {
    const profile = await deps.userProfileRepo.getUserProfile(userId)
    return {
      progress,
      expGained: 0,
      level: levelFromExp(profile?.exp ?? 0),
      unlockedNextLessonId: null,
    }
  }

  const completedProgress: Progress = { ...progress, status: 'completed', completedAt: now }
  await deps.progressRepo.saveProgress(userId, completedProgress)

  const lesson = await deps.lessonRepo.getLessonById(lessonId)
  const allProgress = await deps.progressRepo.getAllProgress(userId)
  const updatedProgress = new Map(allProgress.map((entry) => [entry.lessonId, entry]))
  updatedProgress.set(lessonId, completedProgress)
  const nextLessonId = findContiguousFrontier(
    await getOrderedLearningPath(deps.courseRepo, deps.lessonRepo),
    updatedProgress.values(),
  )?.lesson.id ?? null
  if (nextLessonId) {
    await unlockLesson(deps, userId, nextLessonId)
  }

  const expGained = calculateExpGained(result.accuracy)
  const profile =
    (await deps.userProfileRepo.getUserProfile(userId)) ??
    defaultUserProfile(userId, now)
  const wordsInLesson = lesson?.exercises.length ?? 0
  const priorCompleted = profile.stats.lessonsCompleted
  const updatedProfile: UserProfile = {
    ...profile,
    exp: profile.exp + expGained,
    stats: {
      lessonsCompleted: priorCompleted + 1,
      wordsPracticed: profile.stats.wordsPracticed + wordsInLesson,
      averageAccuracy:
        (profile.stats.averageAccuracy * priorCompleted + result.accuracy) /
        (priorCompleted + 1),
      bestAccuracy: Math.max(profile.stats.bestAccuracy, result.accuracy),
      averageSpeedWpm:
        (profile.stats.averageSpeedWpm * priorCompleted + result.speedWpm) /
        (priorCompleted + 1),
      totalTypingTimeSeconds:
        profile.stats.totalTypingTimeSeconds + result.durationSeconds,
    },
  }
  await deps.userProfileRepo.saveUserProfile(userId, updatedProfile)

  return {
    progress: completedProgress,
    expGained,
    level: levelFromExp(updatedProfile.exp),
    unlockedNextLessonId: nextLessonId,
  }
}
