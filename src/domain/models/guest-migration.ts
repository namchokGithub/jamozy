import type { Progress } from './progress'
import type { ReviewItem } from './review-item'
import type { LearningSession } from './learning-session'
import type { SessionSubmissionOutcome } from '../repositories/session-submission-repository'
import type { UserProfile } from './user-profile'

export interface GuestMigrationSnapshot {
  guestId: string
  profile: UserProfile | null
  progress: Progress[]
  reviewItems: ReviewItem[]
  sessions: LearningSession[]
  sessionOutcomes: SessionSubmissionOutcome[]
}

export interface MigrationCheckpoint {
  guestId: string
  accountId: string
  status: 'started' | 'completed'
  updatedAt: Date
}

export interface MigrationMarker {
  guestId: string
  accountId: string
  completedAt: Date
}

const later = (left: Date | null, right: Date | null): Date | null => {
  if (!left) return right
  if (!right) return left
  return left > right ? left : right
}

export function mergeProfile(cloud: UserProfile | null, guest: UserProfile | null): UserProfile | null {
  if (!cloud) return guest
  if (!guest) return cloud
  const cloudBaseline = cloud.legacyBaseline
  const guestBaseline = guest.legacyBaseline ?? { exp: guest.exp, stats: guest.stats }
  const baseline = cloudBaseline ?? guestBaseline
  const useGuestSettings = !cloud.updatedAt || (guest.updatedAt !== undefined && guest.updatedAt > cloud.updatedAt)
  return {
    ...cloud,
    displayName: cloud.displayName?.trim() ? cloud.displayName : guest.displayName,
    exp: baseline.exp,
    stats: baseline.stats,
    settings: useGuestSettings ? guest.settings : cloud.settings,
    legacyBaseline: baseline,
    updatedAt: later(cloud.updatedAt ?? null, guest.updatedAt ?? null) ?? cloud.createdAt,
  }
}

const progressRank: Record<Progress['status'], number> = { unlocked: 1, completed: 2 }

export function mergeProgress(cloud: Progress | null, guest: Progress): Progress {
  if (!cloud) return guest
  const status = progressRank[guest.status] > progressRank[cloud.status] ? guest.status : cloud.status
  const { completedExerciseIds: _ids, homePartialResult: _partial, ...cloudBase } = cloud
  void _ids
  void _partial
  return {
    ...cloudBase,
    status,
    bestAccuracy: Math.max(cloud.bestAccuracy, guest.bestAccuracy),
    bestSpeedWpm: Math.max(cloud.bestSpeedWpm, guest.bestSpeedWpm),
    attempts: Math.max(cloud.attempts, guest.attempts),
    lastAttemptAt: later(cloud.lastAttemptAt, guest.lastAttemptAt),
    completedAt: later(cloud.completedAt, guest.completedAt),
    ...mergeHomeExerciseProgress(cloud, guest, status),
  }
}

// DEC-043: union completed exercises; a completed lesson keeps no partial
// result, otherwise Cloud's wins unless absent.
function mergeHomeExerciseProgress(cloud: Progress, guest: Progress, status: Progress['status']): Pick<Progress, 'completedExerciseIds' | 'homePartialResult'> {
  const ids = [...new Set([...(cloud.completedExerciseIds ?? []), ...(guest.completedExerciseIds ?? [])])]
  const partial = status === 'completed' ? undefined : cloud.homePartialResult ?? guest.homePartialResult
  return {
    ...(cloud.completedExerciseIds || guest.completedExerciseIds ? { completedExerciseIds: ids } : {}),
    ...(partial ? { homePartialResult: partial } : {}),
  }
}

export function mergeReviewItem(cloud: ReviewItem | null, guest: ReviewItem): ReviewItem {
  if (!cloud) return guest
  return {
    ...cloud,
    nextReviewAt: cloud.nextReviewAt < guest.nextReviewAt ? cloud.nextReviewAt : guest.nextReviewAt,
    box: Math.min(cloud.box, guest.box),
    mistakeCount: Math.max(cloud.mistakeCount, guest.mistakeCount),
    lastMistakeAt: cloud.lastMistakeAt > guest.lastMistakeAt ? cloud.lastMistakeAt : guest.lastMistakeAt,
    resolved: cloud.resolved && guest.resolved,
  }
}
