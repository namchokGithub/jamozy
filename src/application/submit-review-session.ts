import type { JamoCounts } from '../domain/models/jamo-stat'
import type { LessonRepository } from '../domain/repositories/lesson-repository'
import type { ReviewRepository } from '../domain/repositories/review-repository'
import { sessionRewardExp } from '../domain/models/exp-reward'
import type { ExerciseDifficulty } from '../domain/models/lesson'
import type { SessionSubmissionRepository } from '../domain/repositories/session-submission-repository'
import { nextBox, nextReviewDate, type ReviewItem } from '../domain/models/review-item'
import type { UserProfileRepository } from '../domain/repositories/user-profile-repository'
import { deviceTimeZone, sessionStatsFrom, type ExerciseStat } from '../domain/models/player-stats'

export interface SubmitReviewSessionResult {
  itemId: string
  wasCorrect: boolean
  mistakeCount?: number
  typingSeconds?: number
  elapsedSeconds?: number
}

export interface SubmitReviewSessionOutcome {
  correctCount: number
  needsPracticeCount: number
}

export interface SubmitReviewSessionInput {
  submissionId: string
  startedAtMs: number
  durationSeconds: number
  exercisesAttempted: number
  acceptedKeystrokes: number
  rejectedKeystrokes: number
  results: SubmitReviewSessionResult[]
  jamoCounts?: JamoCounts
}

function updatedReview(item: ReviewItem, wasCorrect: boolean, now: Date): ReviewItem {
  const box = nextBox(item.box, wasCorrect)
  return {
    ...item,
    box,
    nextReviewAt: nextReviewDate(box, now),
    resolved: wasCorrect && box === 5,
    mistakeCount: wasCorrect ? item.mistakeCount : item.mistakeCount + 1,
    lastMistakeAt: wasCorrect ? item.lastMistakeAt : now,
  }
}

// Each correct item earns practice EXP by its source exercise's difficulty
// (DEC-045); a missing source lesson or exercise counts as easy. Each source
// lesson is read once, and a failed read also counts as easy so the review
// itself always saves.
async function sourceDifficulties(
  lessonRepo: LessonRepository,
  items: ReviewItem[],
): Promise<Array<ExerciseDifficulty | undefined>> {
  if (items.length === 0) return []
  const lessonIds = [...new Set(items.map((item) => item.sourceLessonId))]
  const lessons = new Map(
    await Promise.all(
      lessonIds.map(
        async (id) =>
          [id, await lessonRepo.getLessonById(id).catch(() => null)] as const,
      ),
    ),
  )
  return items.map(
    (item) =>
      lessons
        .get(item.sourceLessonId)
        ?.exercises.find((exercise) => exercise.id === item.sourceExerciseId)
        ?.difficulty,
  )
}

export async function submitReviewSession(
  deps: { reviewRepo: ReviewRepository; lessonRepo: LessonRepository; sessionSubmissionRepo: SessionSubmissionRepository; userProfileRepo?: UserProfileRepository },
  userId: string,
  input: SubmitReviewSessionInput,
  now: Date = new Date(),
): Promise<SubmitReviewSessionOutcome> {
  let correctCount = 0
  let needsPracticeCount = 0
  const reviewItems: ReviewItem[] = []
  const stats: ExerciseStat[] = []
  const correctItems: ReviewItem[] = []

  for (const result of input.results) {
    const { itemId, wasCorrect } = result
    const item = await deps.reviewRepo.getReviewItem(userId, itemId)
    if (!item) continue

    stats.push({ targetText: item.targetText, lessonType: item.sourceLessonType, mistakeCount: result.mistakeCount ?? (wasCorrect ? 0 : 1), typingSeconds: result.typingSeconds ?? 0, elapsedSeconds: result.elapsedSeconds ?? 0 })

    reviewItems.push(updatedReview(item, wasCorrect, now))
    if (wasCorrect) {
      correctItems.push(item)
      correctCount += 1
    } else {
      needsPracticeCount += 1
    }
  }

  const timeZone = (await deps.userProfileRepo?.getUserProfile(userId))?.timezone ?? deviceTimeZone()
  await deps.sessionSubmissionRepo.submit(userId, {
    id: input.submissionId,
    context: { mode: 'review' },
    startedAt: new Date(input.startedAtMs),
    completedAt: now,
    durationSeconds: input.durationSeconds,
    exercisesAttempted: input.exercisesAttempted,
    acceptedKeystrokes: input.acceptedKeystrokes,
    rejectedKeystrokes: input.rejectedKeystrokes,
    expGained: sessionRewardExp(
      (await sourceDifficulties(deps.lessonRepo, correctItems)).map((difficulty) => ({ kind: 'practice', difficulty })),
    ),
    ...sessionStatsFrom(stats, undefined, timeZone, now),
  }, { progress: [], reviewItems, ...(input.jamoCounts ? { jamoCounts: input.jamoCounts } : {}) })

  return { correctCount, needsPracticeCount }
}
