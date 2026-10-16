import { jamoCountsFrom, mergeJamoCounts } from '../domain/models/jamo-stat'
import { ValidationError } from '../domain/errors'
import type { ExerciseResult } from '../domain/korean/lesson-session'
import type { ExerciseDifficulty, LessonType } from '../domain/models/lesson'
import { sessionRewardExp, type ExpRewardItem } from '../domain/models/exp-reward'
import type { HomePartialResult, Progress } from '../domain/models/progress'
import type { ProgressRepository } from '../domain/repositories/progress-repository'
import {
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
  // difficulty is absent on jobs queued before DEC-045 shipped; it counts as easy.
  lesson: {
    id: string
    type?: LessonType
    exercises: Array<{ id: string; difficulty?: ExerciseDifficulty }>
  }
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
// first cover the lesson, one session is submitted with difficulty-based EXP
// (DEC-045).
// Repeated or post-completion exercises change nothing, so retries are safe.
export async function recordHomeExercise(
  deps: RecordHomeExerciseDeps,
  input: RecordHomeExerciseInput,
): Promise<RecordHomeExerciseOutcome> {
  const { userId, lesson, result } = input
  const now = input.now ?? new Date()
  if (!lesson.exercises.some(({ id }) => id === result.exerciseId))
    throw new ValidationError(
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
    exercises: [...(previous.exercises ?? []), { targetText: result.targetText, mistakeCount: result.mistakes.length, typingSeconds: result.typingSeconds ?? 0, elapsedSeconds: result.elapsedSeconds ?? 0 }],
    jamoCounts: mergeJamoCounts(previous.jamoCounts, jamoCountsFrom([result])),
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
    exercises: partial.exercises,
    jamoCounts: partial.jamoCounts,
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
    expGained: sessionRewardExp(firstCompletionItems(lesson, ids, partial)),
    progress,
    now,
    lessonType: lesson.type,
    isReplay: false,
  })
  return { progress: completed.progress, completed }
}

// One first-completion reward per exercise. Per-exercise stats line up with
// the completed IDs because both grow together; a partial saved before those
// stats existed cannot tell which exercise was perfect, so it earns none.
function firstCompletionItems(
  lesson: RecordHomeExerciseInput['lesson'],
  ids: string[],
  partial: HomePartialResult,
): ExpRewardItem[] {
  const difficulty = new Map(lesson.exercises.map((e) => [e.id, e.difficulty]))
  const stats = partial.exercises?.length === ids.length ? partial.exercises : []
  return ids.map((id, index) => ({
    kind: 'first-completion',
    difficulty: difficulty.get(id),
    perfect: stats[index]?.mistakeCount === 0,
  }))
}
