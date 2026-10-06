import type { HomeSessionTotals } from '../domain/models/home-sync-job'
import type { LearningSession } from '../domain/models/learning-session'
import type { Progress } from '../domain/models/progress'
import type { SessionSubmissionRepository } from '../domain/repositories/session-submission-repository'
import type { UserProfileRepository } from '../domain/repositories/user-profile-repository'
import { defaultUserProfile, levelFromExp } from '../domain/models/user-profile'

export interface HomeSessionDeps {
  userProfileRepo: UserProfileRepository
  sessionSubmissionRepo: SessionSubmissionRepository
}

export type { HomeSessionTotals }

export interface HomeSessionOutcome {
  progress: Progress
  expGained: number
  level: number
}

export function accuracyOf(
  totals: Pick<HomeSessionTotals, 'acceptedKeystrokes' | 'rejectedKeystrokes'>,
): number {
  const total = totals.acceptedKeystrokes + totals.rejectedKeystrokes
  return total === 0 ? 0 : (totals.acceptedKeystrokes / total) * 100
}

export function speedWpmOf(
  totals: Pick<HomeSessionTotals, 'acceptedKeystrokes' | 'durationSeconds'>,
): number {
  return totals.durationSeconds === 0
    ? 0
    : totals.acceptedKeystrokes / 5 / (totals.durationSeconds / 60)
}

// Submits one Home LearningSession with its Progress effect. Home never
// creates ReviewItems and never touches the Learning Path frontier (DEC-043).
// The receipt is keyed by sessionId, so a retried submit is a no-op.
export async function submitHomeSession(
  deps: HomeSessionDeps,
  userId: string,
  input: {
    sessionId: string
    lessonId: string
    totals: HomeSessionTotals
    expGained: number
    progress: Progress
    now: Date
  },
): Promise<HomeSessionOutcome> {
  const session: LearningSession = {
    id: input.sessionId,
    context: { mode: 'home', lessonId: input.lessonId },
    startedAt: new Date(input.totals.startedAtMs),
    completedAt: input.now,
    durationSeconds: input.totals.durationSeconds,
    exercisesAttempted: input.totals.exercisesAttempted,
    acceptedKeystrokes: input.totals.acceptedKeystrokes,
    rejectedKeystrokes: input.totals.rejectedKeystrokes,
    expGained: input.expGained,
  }
  const profile =
    (await deps.userProfileRepo.getUserProfile(userId)) ??
    defaultUserProfile(userId, input.now)
  const submission = await deps.sessionSubmissionRepo.submit(userId, session, {
    progress: [input.progress],
    reviewItems: [],
  })
  return {
    progress: submission.effects.progress[0] ?? input.progress,
    expGained: submission.session.expGained,
    level: levelFromExp(profile.exp + submission.session.expGained),
  }
}

// Progress written by a Home submission. Built without undefined fields,
// which Firestore rejects.
export function homeAttemptProgress(
  lessonId: string,
  existing: Progress | null,
  totals: HomeSessionTotals,
  now: Date,
  fields: Pick<Progress, 'status' | 'completedAt'> & {
    completedExerciseIds: string[]
  },
): Progress {
  return {
    lessonId,
    status: fields.status,
    bestAccuracy: Math.max(existing?.bestAccuracy ?? 0, accuracyOf(totals)),
    bestSpeedWpm: Math.max(existing?.bestSpeedWpm ?? 0, speedWpmOf(totals)),
    attempts: (existing?.attempts ?? 0) + 1,
    lastAttemptAt: now,
    completedAt: fields.completedAt,
    completedExerciseIds: fields.completedExerciseIds,
  }
}
