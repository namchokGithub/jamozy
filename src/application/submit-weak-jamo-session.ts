import type { JamoCounts } from '../domain/models/jamo-stat'
import type { LessonType } from '../domain/models/lesson'
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

// Weak Jamo practice (DEC-051): records history and stats only. It never
// touches ReviewItems or Progress, and awards no EXP until practice EXP
// (DEC-045) ships for every practice mode.
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
      expGained: 0,
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
