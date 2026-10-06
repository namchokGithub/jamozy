import type { DocumentData } from 'firebase/firestore'
import { Timestamp } from 'firebase/firestore'
import type {
  HomePartialResult,
  Progress,
} from '../../../domain/models/progress'

export function toProgress(
  lessonId: string,
  data: DocumentData,
): Progress | null {
  if (data.status === 'locked') return null
  return {
    lessonId,
    status: data.status as Progress['status'],
    bestAccuracy: data.bestAccuracy,
    bestSpeedWpm: data.bestSpeedWpm,
    attempts: data.attempts,
    lastAttemptAt: data.lastAttemptAt ? data.lastAttemptAt.toDate() : null,
    completedAt: data.completedAt ? data.completedAt.toDate() : null,
    ...(Array.isArray(data.completedExerciseIds)
      ? { completedExerciseIds: data.completedExerciseIds as string[] }
      : {}),
    ...(data.homePartialResult
      ? { homePartialResult: data.homePartialResult as HomePartialResult }
      : {}),
  }
}

export function toProgressDoc(progress: Progress): DocumentData {
  return {
    lessonId: progress.lessonId,
    status: progress.status,
    bestAccuracy: progress.bestAccuracy,
    bestSpeedWpm: progress.bestSpeedWpm,
    attempts: progress.attempts,
    lastAttemptAt: progress.lastAttemptAt
      ? Timestamp.fromDate(progress.lastAttemptAt)
      : null,
    completedAt: progress.completedAt
      ? Timestamp.fromDate(progress.completedAt)
      : null,
    // Home-only fields (DEC-043); omitted rather than undefined, which
    // Firestore rejects.
    ...(progress.completedExerciseIds
      ? { completedExerciseIds: progress.completedExerciseIds }
      : {}),
    ...(progress.homePartialResult
      ? { homePartialResult: progress.homePartialResult }
      : {}),
  }
}
