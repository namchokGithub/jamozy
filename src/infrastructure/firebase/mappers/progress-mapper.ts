import type { DocumentData } from 'firebase/firestore'
import { Timestamp } from 'firebase/firestore'
import type { Progress } from '../../../domain/models/progress'

export function toProgress(lessonId: string, data: DocumentData): Progress {
  return {
    lessonId,
    status: data.status,
    bestAccuracy: data.bestAccuracy,
    bestSpeedWpm: data.bestSpeedWpm,
    attempts: data.attempts,
    lastAttemptAt: data.lastAttemptAt ? data.lastAttemptAt.toDate() : null,
    completedAt: data.completedAt ? data.completedAt.toDate() : null,
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
  }
}
