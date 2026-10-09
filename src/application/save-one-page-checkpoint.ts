import { jamoCountsFrom, mergeJamoCounts } from '../domain/models/jamo-stat'
import type { ExerciseResult, LessonResult } from '../domain/korean/lesson-session'
import type { Lesson } from '../domain/models/lesson'
import type { OnePageLearningCheckpoint, OnePagePartialLessonResult } from '../domain/models/one-page-learning-checkpoint'
import type { OnePageLearningCheckpointRepository } from '../domain/repositories/one-page-learning-checkpoint-repository'

export interface RecordOnePageExerciseInput {
  userId: string
  courseId: string
  lesson: Lesson
  result: ExerciseResult
  now?: Date
}

export interface RecordOnePageExerciseResult {
  checkpoint: OnePageLearningCheckpoint
  completedLesson: { lessonId: string; result: LessonResult; submissionId: string } | null
}

function newPartial(now: Date): OnePagePartialLessonResult {
  return {
    submissionId: crypto.randomUUID(),
    startedAtMs: now.getTime(),
    acceptedKeystrokes: 0,
    rejectedKeystrokes: 0,
    completedExerciseIds: [],
    mistakes: [],
  }
}

function lessonResult(partial: OnePagePartialLessonResult, now: Date): LessonResult {
  const total = partial.acceptedKeystrokes + partial.rejectedKeystrokes
  const durationSeconds = (now.getTime() - partial.startedAtMs) / 1000
  return {
    accuracy: total === 0 ? 0 : (partial.acceptedKeystrokes / total) * 100,
    speedWpm: durationSeconds === 0 ? 0 : (partial.acceptedKeystrokes / 5) / (durationSeconds / 60),
    durationSeconds,
    startedAtMs: partial.startedAtMs,
    exercisesAttempted: partial.completedExerciseIds.length,
    acceptedKeystrokes: partial.acceptedKeystrokes,
    rejectedKeystrokes: partial.rejectedKeystrokes,
    mistakes: partial.mistakes,
    exercises: partial.exercises ?? [],
    ...(partial.jamoCounts ? { jamoCounts: partial.jamoCounts } : {}),
  }
}

export function getCheckpointedLessonCompletion(
  checkpoint: OnePageLearningCheckpoint,
  lesson: Lesson,
  now: Date = new Date(),
): { lessonId: string; result: LessonResult; submissionId: string } | null {
  const partial = checkpoint.partialLessonResults[lesson.id]
  if (!partial || lesson.exercises.length === 0) return null
  if (!lesson.exercises.every((exercise) => partial.completedExerciseIds.includes(exercise.id))) return null
  return { lessonId: lesson.id, result: lessonResult(partial, now), submissionId: partial.submissionId }
}

export async function recordOnePageExercise(
  checkpointRepo: OnePageLearningCheckpointRepository,
  input: RecordOnePageExerciseInput,
): Promise<RecordOnePageExerciseResult> {
  const now = input.now ?? new Date()
  const current = await checkpointRepo.getCheckpoint(input.userId, input.courseId)
  const checkpoint: OnePageLearningCheckpoint = current ?? {
    userId: input.userId,
    courseId: input.courseId,
    completedExerciseIdsByLesson: {},
    partialLessonResults: {},
    updatedAt: now,
  }
  const existing = checkpoint.partialLessonResults[input.lesson.id] ?? newPartial(now)
  const alreadyCompleted = existing.completedExerciseIds.includes(input.result.exerciseId)
  const completedExerciseIds = alreadyCompleted
    ? existing.completedExerciseIds
    : [...existing.completedExerciseIds, input.result.exerciseId]
  const partial: OnePagePartialLessonResult = alreadyCompleted
    ? existing
    : {
        ...existing,
        completedExerciseIds,
        acceptedKeystrokes: existing.acceptedKeystrokes + input.result.correctKeyCount,
        rejectedKeystrokes: existing.rejectedKeystrokes + input.result.mistakes.length,
        mistakes: input.result.mistakes.length > 0
          ? [...existing.mistakes, { sourceExerciseId: input.result.exerciseId, targetText: input.result.targetText }]
          : existing.mistakes,
        exercises: [...(existing.exercises ?? []), {
          targetText: input.result.targetText,
          mistakeCount: input.result.mistakes.length,
          typingSeconds: input.result.typingSeconds ?? 0,
          elapsedSeconds: input.result.elapsedSeconds ?? 0,
        }],
        jamoCounts: mergeJamoCounts(existing.jamoCounts, jamoCountsFrom([input.result])),
      }
  const nextCheckpoint: OnePageLearningCheckpoint = {
    ...checkpoint,
    completedExerciseIdsByLesson: {
      ...checkpoint.completedExerciseIdsByLesson,
      [input.lesson.id]: completedExerciseIds,
    },
    partialLessonResults: {
      ...checkpoint.partialLessonResults,
      [input.lesson.id]: partial,
    },
    updatedAt: now,
  }
  await checkpointRepo.saveCheckpoint(nextCheckpoint)
  const completedLesson = getCheckpointedLessonCompletion(nextCheckpoint, input.lesson, now)
  return {
    checkpoint: nextCheckpoint,
    completedLesson,
  }
}
