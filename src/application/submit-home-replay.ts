import type { ProgressRepository } from '../domain/repositories/progress-repository'
import {
  homeAttemptProgress,
  submitHomeSession,
  type HomeSessionDeps,
  type HomeSessionOutcome,
  type HomeSessionTotals,
} from './home-session-submission'

export const HOME_REPLAY_EXP = 15

export interface SubmitHomeReplayDeps extends HomeSessionDeps {
  progressRepo: ProgressRepository
}

export interface SubmitHomeReplayInput {
  userId: string
  lessonId: string
  // A new ID per replay session ([[DEC-029]]); reused only by retries.
  sessionId: string
  totals: HomeSessionTotals
  now?: Date
}

// Submits a full shuffled session of an already-completed Home lesson for a
// flat 15 EXP (DEC-033, DEC-043). Completion and exercise progress are kept.
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
    expGained: HOME_REPLAY_EXP,
    progress: homeAttemptProgress(input.lessonId, existing, input.totals, now, {
      status: 'completed',
      completedAt: existing.completedAt,
      completedExerciseIds: existing.completedExerciseIds ?? [],
    }),
    now,
  })
}
