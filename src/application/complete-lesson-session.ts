import type { CourseRepository } from '../domain/repositories/course-repository'
import type { LessonRepository } from '../domain/repositories/lesson-repository'
import type { ProgressRepository } from '../domain/repositories/progress-repository'
import type { ReviewRepository } from '../domain/repositories/review-repository'
import type { SessionSubmissionRepository } from '../domain/repositories/session-submission-repository'
import type { UserProfileRepository } from '../domain/repositories/user-profile-repository'
import type { LessonResult } from '../domain/korean/lesson-session'
import type { Progress } from '../domain/models/progress'
import { nextReviewDate, type ReviewItem } from '../domain/models/review-item'
import { defaultUserProfile, levelFromExp } from '../domain/models/user-profile'
import type { CompleteLessonOutcome } from './complete-lesson'
import { findContiguousFrontier, getOrderedLearningPath } from './learning-path-order'

export interface CompleteLessonSessionDeps {
  courseRepo: CourseRepository
  lessonRepo: LessonRepository
  progressRepo: ProgressRepository
  userProfileRepo: UserProfileRepository
  reviewRepo: ReviewRepository
  sessionSubmissionRepo: SessionSubmissionRepository
}

function expForAccuracy(accuracy: number): number {
  return 100 + (accuracy > 90 ? 20 : 0) + (accuracy === 100 ? 50 : 0)
}

async function reviewEffects(repo: ReviewRepository, userId: string, lessonId: string, result: LessonResult, now: Date): Promise<ReviewItem[]> {
  return Promise.all(result.mistakes.map(async (mistake) => {
    const existing = await repo.getReviewItem(userId, mistake.sourceExerciseId)
    if (existing) {
      return { ...existing, mistakeCount: existing.mistakeCount + 1, lastMistakeAt: now, resolved: false, box: 1, nextReviewAt: nextReviewDate(1, now) }
    }
    return { id: mistake.sourceExerciseId, sourceLessonId: lessonId, sourceExerciseId: mistake.sourceExerciseId, targetText: mistake.targetText, reason: 'mistake' as const, mistakeCount: 1, lastMistakeAt: now, resolved: false, box: 1, nextReviewAt: nextReviewDate(1, now) }
  }))
}

export async function completeLessonSession(
  deps: CompleteLessonSessionDeps,
  userId: string,
  lessonId: string,
  result: LessonResult,
  submissionId: string,
  now: Date = new Date(),
): Promise<CompleteLessonOutcome> {
  const existing = await deps.progressRepo.getProgress(userId, lessonId)
  const attempted: Progress = {
    lessonId,
    status: existing?.status ?? 'unlocked',
    bestAccuracy: Math.max(existing?.bestAccuracy ?? 0, result.accuracy),
    bestSpeedWpm: Math.max(existing?.bestSpeedWpm ?? 0, result.speedWpm),
    attempts: (existing?.attempts ?? 0) + 1,
    lastAttemptAt: now,
    completedAt: existing?.completedAt ?? null,
  }
  const wasAlreadyCompleted = existing?.status === 'completed'
  const completed: Progress = wasAlreadyCompleted
    ? attempted
    : { ...attempted, status: 'completed', completedAt: now }
  const allProgress = await deps.progressRepo.getAllProgress(userId)
  const updatedProgress = new Map(allProgress.map((entry) => [entry.lessonId, entry]))
  updatedProgress.set(lessonId, completed)
  const frontier = wasAlreadyCompleted
    ? null
    : findContiguousFrontier(
        await getOrderedLearningPath(deps.courseRepo, deps.lessonRepo),
        updatedProgress.values(),
      )
  const unlockedNextLessonId = frontier?.lesson.id ?? null
  const progress = [completed]
  if (unlockedNextLessonId) {
    const next = await deps.progressRepo.getProgress(userId, unlockedNextLessonId)
    if (!next) {
      progress.push({ lessonId: unlockedNextLessonId, status: 'unlocked', bestAccuracy: 0, bestSpeedWpm: 0, attempts: 0, lastAttemptAt: null, completedAt: null })
    }
  }
  const expGained = wasAlreadyCompleted ? 15 : expForAccuracy(result.accuracy)
  const profile = (await deps.userProfileRepo.getUserProfile(userId)) ?? defaultUserProfile(userId, now)
  const submission = await deps.sessionSubmissionRepo.submit(userId, {
    id: submissionId,
    context: { mode: 'learning-path', lessonId },
    startedAt: new Date(result.startedAtMs),
    completedAt: now,
    durationSeconds: result.durationSeconds,
    exercisesAttempted: result.exercisesAttempted,
    acceptedKeystrokes: result.acceptedKeystrokes,
    rejectedKeystrokes: result.rejectedKeystrokes,
    expGained,
  }, { progress, reviewItems: wasAlreadyCompleted ? [] : await reviewEffects(deps.reviewRepo, userId, lessonId, result, now) })
  const persistedProgress = submission.effects.progress.find((candidate) => candidate.lessonId === lessonId) ?? completed
  return { progress: persistedProgress, expGained: submission.session.expGained, level: levelFromExp(profile.exp + submission.session.expGained), unlockedNextLessonId }
}
