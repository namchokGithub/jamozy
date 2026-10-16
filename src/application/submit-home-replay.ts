import type { ProgressRepository } from '../domain/repositories/progress-repository'
import type { ExerciseDifficulty, LessonType } from '../domain/models/lesson'
import { sessionRewardExp } from '../domain/models/exp-reward'
import {
  homeAttemptProgress,
  submitHomeSession,
  type HomeSessionDeps,
  type HomeSessionOutcome,
  type HomeSessionTotals,
} from './home-session-submission'

export interface SubmitHomeReplayDeps extends HomeSessionDeps {
  progressRepo: ProgressRepository
}

export interface SubmitHomeReplayInput {
  userId: string
  lessonId: string
  // A new ID per replay session ([[DEC-029]]); reused only by retries.
  sessionId: string
  totals: HomeSessionTotals
  lessonType?: LessonType
  // One per replayed exercise; absent on jobs queued before DEC-046 shipped.
  difficulties?: ExerciseDifficulty[]
  now?: Date
}

// Submits a full shuffled session of an already-completed Home lesson for
// practice EXP per exercise by difficulty (DEC-043, DEC-046); without
// difficulties, each attempted exercise counts as easy. Completion and exercise progress are kept.
// Returns null when the lesson is not completed, so no replay is recorded.
export async function submitHomeReplay(
  deps: SubmitHomeReplayDeps,
  input: SubmitHomeReplayInput,
): Promise<HomeSessionOutcome | null> {
  const now = input.now ?? new Date()
  const existing = await deps.progressRepo.getProgress(
    input.userId,
    input.lessonId,
  )
  if (existing?.status !== 'completed') return null
  return submitHomeSession(deps, input.userId, {
    sessionId: input.sessionId,
    lessonId: input.lessonId,
    totals: input.totals,
    expGained: sessionRewardExp(
      (
        input.difficulties ??
        Array.from({ length: input.totals.exercisesAttempted }, () => undefined)
      ).map((difficulty) => ({ kind: 'practice', difficulty })),
    ),
    progress: homeAttemptProgress(input.lessonId, existing, input.totals, now, {
      status: 'completed',
      completedAt: existing.completedAt,
      completedExerciseIds: existing.completedExerciseIds ?? [],
    }),
    now,
    lessonType: input.lessonType,
    isReplay: true,
  })
}
