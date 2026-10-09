import {
  getLessonResult,
  type LessonSessionState,
} from '../korean/lesson-session'
import type { HomeSessionTotals } from '../models/home-sync-job'
import type { Progress } from '../models/progress'

// Pure Home session rules (DEC-043). Structural types keep these usable with
// both the static export and test fixtures.
interface HomeLessonShape {
  id: string
  exercises: Array<{ id: string }>
}

interface HomeUnitShape {
  id: string
  lessons: HomeLessonShape[]
}

export interface HomeLessonRef {
  unitId: string
  lessonId: string
}

/** A new order for one session: every exercise exactly once (Fisher-Yates). */
export function shuffleExercises<T>(
  exercises: readonly T[],
  random: () => number = Math.random,
): T[] {
  const shuffled = [...exercises]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]]
  }
  return shuffled
}

function lessonRefs(units: readonly HomeUnitShape[]): HomeLessonRef[] {
  return units.flatMap((unit) =>
    unit.lessons.map((lesson) => ({ unitId: unit.id, lessonId: lesson.id })),
  )
}

/**
 * The lesson after `lessonId`: the next one in its unit, then the first of
 * the next unit. Null after the last lesson, when the Home course is done.
 */
export function nextHomeLesson(
  units: readonly HomeUnitShape[],
  lessonId: string,
): HomeLessonRef | null {
  const refs = lessonRefs(units)
  const index = refs.findIndex((ref) => ref.lessonId === lessonId)
  return index === -1 ? null : (refs[index + 1] ?? null)
}

/**
 * Where Home opens: the saved lesson if it still exists (in its current
 * unit), otherwise the first lesson. Null when there are no lessons.
 */
export function resolveHomeResume(
  units: readonly HomeUnitShape[],
  saved: HomeLessonRef | null,
): HomeLessonRef | null {
  const refs = lessonRefs(units)
  return refs.find((ref) => ref.lessonId === saved?.lessonId) ?? refs[0] ?? null
}

/**
 * Distinct exercises completed out of the lesson's total. Exercises still
 * waiting in the outbox count; a completed lesson is always full.
 */
export function homeLessonProgress(
  lesson: HomeLessonShape,
  progress: Progress | null,
  pendingExerciseIds: ReadonlySet<string> = new Set(),
): { done: number; total: number } {
  const total = lesson.exercises.length
  if (progress?.status === 'completed') return { done: total, total }
  const done = new Set([
    ...(progress?.completedExerciseIds ?? []),
    ...pendingExerciseIds,
  ])
  return {
    done: lesson.exercises.filter(({ id }) => done.has(id)).length,
    total,
  }
}

/** Totals of a finished session, submitted as a replay of a completed lesson. */
export function homeReplayTotals(
  state: LessonSessionState,
  now: Date = new Date(),
): HomeSessionTotals {
  const result = getLessonResult(state, now)
  return {
    startedAtMs: result.startedAtMs,
    durationSeconds: result.durationSeconds,
    exercisesAttempted: result.exercisesAttempted,
    acceptedKeystrokes: result.acceptedKeystrokes,
    rejectedKeystrokes: result.rejectedKeystrokes,
    exercises: result.exercises ?? [],
  }
}
