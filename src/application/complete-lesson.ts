import type { CourseRepository } from '../domain/repositories/course-repository'
import type { LessonRepository } from '../domain/repositories/lesson-repository'
import type { ProgressRepository } from '../domain/repositories/progress-repository'
import type { UserProfileRepository } from '../domain/repositories/user-profile-repository'
import type { Progress } from '../domain/models/progress'
import { defaultUserProfile, levelFromExp, type UserProfile } from '../domain/models/user-profile'
import { updateProgress, type AttemptResult } from './update-progress'

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

async function findNextLessonId(
  deps: CompleteLessonDeps,
  unitId: string,
  lessonId: string,
): Promise<string | null> {
  const lessonsInUnit = await deps.lessonRepo.getLessonsByUnitId(unitId)
  const indexInUnit = lessonsInUnit.findIndex((l) => l.id === lessonId)
  const nextInUnit = lessonsInUnit[indexInUnit + 1]
  if (nextInUnit) return nextInUnit.id

  const currentUnit = await deps.courseRepo.getUnitById(unitId)
  if (!currentUnit) return null

  const unitsInCourse = await deps.courseRepo.getUnitsByCourseId(
    currentUnit.courseId,
  )
  const indexInCourse = unitsInCourse.findIndex((u) => u.id === unitId)
  const nextUnit = unitsInCourse[indexInCourse + 1]
  if (!nextUnit) return null

  const lessonsInNextUnit = await deps.lessonRepo.getLessonsByUnitId(
    nextUnit.id,
  )
  return lessonsInNextUnit[0]?.id ?? null
}

async function unlockLesson(
  deps: CompleteLessonDeps,
  userId: string,
  lessonId: string,
): Promise<void> {
  const existing = await deps.progressRepo.getProgress(userId, lessonId)
  if (existing && existing.status !== 'locked') return

  await deps.progressRepo.saveProgress(userId, {
    lessonId,
    status: 'unlocked',
    bestAccuracy: existing?.bestAccuracy ?? 0,
    bestSpeedWpm: existing?.bestSpeedWpm ?? 0,
    attempts: existing?.attempts ?? 0,
    lastAttemptAt: existing?.lastAttemptAt ?? null,
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
  const nextLessonId = lesson
    ? await findNextLessonId(deps, lesson.unitId, lessonId)
    : null
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
