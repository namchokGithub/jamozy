import type { LearningSession } from './learning-session'
import type { UserStats } from './user-profile'

export interface LegacyBaseline { exp: number; stats: UserStats }
export interface SessionAggregate {
  exp: number
  lessonsCompleted?: number
  exercisesAttempted: number
  acceptedKeystrokes: number
  rejectedKeystrokes: number
  totalTypingTimeSeconds: number
  bestAccuracy: number
}

export const emptySessionAggregate = (): SessionAggregate => ({ exp: 0, lessonsCompleted: 0, exercisesAttempted: 0, acceptedKeystrokes: 0, rejectedKeystrokes: 0, totalTypingTimeSeconds: 0, bestAccuracy: 0 })

export function aggregateFromSession(session: Pick<LearningSession, 'context' | 'expGained' | 'exercisesAttempted' | 'acceptedKeystrokes' | 'rejectedKeystrokes' | 'durationSeconds'>): SessionAggregate {
  const total = session.acceptedKeystrokes + session.rejectedKeystrokes
  return { exp: session.expGained, lessonsCompleted: session.context.mode === 'learning-path' && session.expGained > 0 ? 1 : 0, exercisesAttempted: session.exercisesAttempted, acceptedKeystrokes: session.acceptedKeystrokes, rejectedKeystrokes: session.rejectedKeystrokes, totalTypingTimeSeconds: session.durationSeconds, bestAccuracy: total === 0 ? 0 : (session.acceptedKeystrokes / total) * 100 }
}

export function addSessionAggregate(current: SessionAggregate, next: SessionAggregate): SessionAggregate {
  return { exp: current.exp + next.exp, lessonsCompleted: (current.lessonsCompleted ?? 0) + (next.lessonsCompleted ?? 0), exercisesAttempted: current.exercisesAttempted + next.exercisesAttempted, acceptedKeystrokes: current.acceptedKeystrokes + next.acceptedKeystrokes, rejectedKeystrokes: current.rejectedKeystrokes + next.rejectedKeystrokes, totalTypingTimeSeconds: current.totalTypingTimeSeconds + next.totalTypingTimeSeconds, bestAccuracy: Math.max(current.bestAccuracy, next.bestAccuracy) }
}
