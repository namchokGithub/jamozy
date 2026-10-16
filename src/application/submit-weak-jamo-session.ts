import type { JamoCounts } from '../domain/models/jamo-stat'
import type { ExerciseDifficulty, LessonType } from '../domain/models/lesson'
import { sessionRewardExp } from '../domain/models/exp-reward'
import {
  deviceTimeZone,
  sessionStatsFrom,
} from '../domain/models/player-stats'
import type { SessionSubmissionRepository } from '../domain/repositories/session-submission-repository'
import type { UserProfileRepository } from '../domain/repositories/user-profile-repository'

export interface WeakJamoResult {
  exerciseId: string
  targetText: string
  lessonType: LessonType
  // Absent counts as easy (DEC-045).
  difficulty?: ExerciseDifficulty
  wasCorrect: boolean
  mistakeCount: number
  typingSeconds: number
  elapsedSeconds: number
}

export interface SubmitWeakJamoSessionInput {
  submissionId: string
  startedAtMs: number
  durationSeconds: number
  exercisesAttempted: number
  acceptedKeystrokes: number
  rejectedKeystrokes: number
  results: WeakJamoResult[]
  jamoCounts?: JamoCounts
}

export interface SubmitWeakJamoSessionOutcome {
  correctCount: number
  needsPracticeCount: number
}

// Weak Jamo practice (DEC-051): records history and stats, and awards
// practice EXP for each correct exercise by difficulty (DEC-045). It never
// touches ReviewItems or Progress.
export async function submitWeakJamoSession(
  deps: {
    sessionSubmissionRepo: SessionSubmissionRepository
    userProfileRepo?: UserProfileRepository
  },
  userId: string,
  input: SubmitWeakJamoSessionInput,
  now: Date = new Date(),
): Promise<SubmitWeakJamoSessionOutcome> {
  const timeZone =
    (await deps.userProfileRepo?.getUserProfile(userId))?.timezone ??
    deviceTimeZone()
  const stats = input.results.map(
    ({ targetText, lessonType, mistakeCount, typingSeconds, elapsedSeconds }) => ({
      targetText,
      lessonType,
      mistakeCount,
      typingSeconds,
      elapsedSeconds,
    }),
  )
  await deps.sessionSubmissionRepo.submit(
    userId,
    {
      id: input.submissionId,
      context: { mode: 'weak-jamo' },
      startedAt: new Date(input.startedAtMs),
      completedAt: now,
      durationSeconds: input.durationSeconds,
      exercisesAttempted: input.exercisesAttempted,
      acceptedKeystrokes: input.acceptedKeystrokes,
      rejectedKeystrokes: input.rejectedKeystrokes,
      expGained: sessionRewardExp(
        input.results
          .filter((result) => result.wasCorrect)
          .map(({ difficulty }) => ({ kind: 'practice', difficulty })),
      ),
      ...sessionStatsFrom(stats, undefined, timeZone, now),
    },
    {
      progress: [],
      reviewItems: [],
      ...(input.jamoCounts ? { jamoCounts: input.jamoCounts } : {}),
    },
  )
  const correctCount = input.results.filter((result) => result.wasCorrect).length
  return {
    correctCount,
    needsPracticeCount: input.results.length - correctCount,
  }
}
