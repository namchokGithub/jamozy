import type { ExerciseResult } from '../domain/korean/lesson-session'
import type { HomePartialResult, Progress } from '../domain/models/progress'
import type { ProgressRepository } from '../domain/repositories/progress-repository'
import { expForAccuracy } from './complete-lesson-session'
import {
  accuracyOf,
  homeAttemptProgress,
  submitHomeSession,
  type HomeSessionDeps,
  type HomeSessionOutcome,
} from './home-session-submission'

export interface RecordHomeExerciseDeps extends HomeSessionDeps {
  progressRepo: ProgressRepository
}

export interface RecordHomeExerciseInput {
  userId: string
  lesson: { id: string; exercises: Array<{ id: string }> }
  result: ExerciseResult
  // Used only when this is the lesson's first recorded exercise; it becomes
  // the first-completion session ID.
  submissionId: string
  now?: Date
}

export interface RecordHomeExerciseOutcome {
  progress: Progress | null
  completed: HomeSessionOutcome | null
}

// Records one completed Home exercise (DEC-043). Distinct exercises and the
// raw totals of their first completions accumulate on Progress; when they
// first cover the lesson, one session is submitted with accuracy-based EXP.
// Repeated or post-completion exercises change nothing, so retries are safe.
export async function recordHomeExercise(
  deps: RecordHomeExerciseDeps,
  input: RecordHomeExerciseInput,
): Promise<RecordHomeExerciseOutcome> {
  const { userId, lesson, result } = input
  const now = input.now ?? new Date()
  if (!lesson.exercises.some(({ id }) => id === result.exerciseId))
    throw new Error(
      `Exercise ${result.exerciseId} does not belong to lesson ${lesson.id}`,
    )

  const existing = await deps.progressRepo.getProgress(userId, lesson.id)
  const completedIds = existing?.completedExerciseIds ?? []
  if (
    existing?.status === 'completed' ||
    completedIds.includes(result.exerciseId)
  )
    return { progress: existing, completed: null }

  const previous: HomePartialResult = existing?.homePartialResult ?? {
    submissionId: input.submissionId,
    startedAtMs: now.getTime(),
    acceptedKeystrokes: 0,
    rejectedKeystrokes: 0,
  }
  const partial: HomePartialResult = {
    ...previous,
    acceptedKeystrokes: previous.acceptedKeystrokes + result.correctKeyCount,
    rejectedKeystrokes: previous.rejectedKeystrokes + result.mistakes.length,
  }
  const ids = [...completedIds, result.exerciseId]

  if (!lesson.exercises.every(({ id }) => ids.includes(id))) {
    const progress: Progress = {
      lessonId: lesson.id,
      status: 'unlocked',
      bestAccuracy: existing?.bestAccuracy ?? 0,
      bestSpeedWpm: existing?.bestSpeedWpm ?? 0,
      attempts: existing?.attempts ?? 0,
      lastAttemptAt: now,
      completedAt: null,
      completedExerciseIds: ids,
      homePartialResult: partial,
    }
    await deps.progressRepo.saveProgress(userId, progress)
    return { progress, completed: null }
  }

  const totals = {
    startedAtMs: partial.startedAtMs,
    durationSeconds: Math.max((now.getTime() - partial.startedAtMs) / 1000, 0),
    exercisesAttempted: ids.length,
    acceptedKeystrokes: partial.acceptedKeystrokes,
    rejectedKeystrokes: partial.rejectedKeystrokes,
  }
  const progress = homeAttemptProgress(lesson.id, existing, totals, now, {
    status: 'completed',
    completedAt: now,
    completedExerciseIds: ids,
  })
  const completed = await submitHomeSession(deps, userId, {
    sessionId: partial.submissionId,
    lessonId: lesson.id,
    totals,
    expGained: expForAccuracy(accuracyOf(totals)),
    progress,
    now,
  })
  return { progress: completed.progress, completed }
}
