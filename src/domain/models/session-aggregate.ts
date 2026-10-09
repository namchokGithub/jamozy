import type { LearningSession } from './learning-session'
import { periodStatsFrom } from './player-stats'
import type { UserStats } from './user-profile'

export interface LegacyBaseline { exp: number; stats: UserStats }
export interface SessionAggregate {
  exp: number
  exercisesAttempted: number
  acceptedKeystrokes: number
  rejectedKeystrokes: number
  // Learning Time: session length (DEC-049). Typing Time is typingSeconds.
  totalTypingTimeSeconds: number
  bestAccuracy: number
  lessonsCompleted?: number
  lessonsReplayed?: number
  reviewsCompleted?: number
  perfectLessons?: number
  charactersTyped?: number
  wordsPracticed?: number
  sentencesPracticed?: number
  typingSeconds?: number
  longestSessionSeconds?: number
  bestWpm?: number
}

export const emptySessionAggregate = (): SessionAggregate => ({ exp: 0, exercisesAttempted: 0, acceptedKeystrokes: 0, rejectedKeystrokes: 0, totalTypingTimeSeconds: 0, bestAccuracy: 0, lessonsCompleted: 0, lessonsReplayed: 0, reviewsCompleted: 0, perfectLessons: 0, charactersTyped: 0, wordsPracticed: 0, sentencesPracticed: 0, typingSeconds: 0, longestSessionSeconds: 0, bestWpm: 0 })

export function aggregateFromSession(session: LearningSession): SessionAggregate {
  const total = session.acceptedKeystrokes + session.rejectedKeystrokes
  const period = periodStatsFrom(session)
  const learningSeconds = session.learningSeconds ?? session.durationSeconds
  const typingSeconds = session.typingSeconds ?? 0
  return { exp: session.expGained, exercisesAttempted: session.exercisesAttempted, acceptedKeystrokes: session.acceptedKeystrokes, rejectedKeystrokes: session.rejectedKeystrokes, totalTypingTimeSeconds: learningSeconds, bestAccuracy: total === 0 ? 0 : (session.acceptedKeystrokes / total) * 100, lessonsCompleted: period.lessonsCompleted, lessonsReplayed: period.lessonsReplayed, reviewsCompleted: period.reviewsCompleted, perfectLessons: period.perfectLessons, charactersTyped: period.charactersTyped, wordsPracticed: period.wordsPracticed, sentencesPracticed: period.sentencesPracticed, typingSeconds: period.typingSeconds, longestSessionSeconds: learningSeconds, bestWpm: typingSeconds > 0 ? session.acceptedKeystrokes / 5 / (typingSeconds / 60) : 0 }
}

export function addSessionAggregate(current: SessionAggregate, next: SessionAggregate): SessionAggregate {
  return { exp: current.exp + next.exp, exercisesAttempted: current.exercisesAttempted + next.exercisesAttempted, acceptedKeystrokes: current.acceptedKeystrokes + next.acceptedKeystrokes, rejectedKeystrokes: current.rejectedKeystrokes + next.rejectedKeystrokes, totalTypingTimeSeconds: current.totalTypingTimeSeconds + next.totalTypingTimeSeconds, bestAccuracy: Math.max(current.bestAccuracy, next.bestAccuracy), lessonsCompleted: (current.lessonsCompleted ?? 0) + (next.lessonsCompleted ?? 0), lessonsReplayed: (current.lessonsReplayed ?? 0) + (next.lessonsReplayed ?? 0), reviewsCompleted: (current.reviewsCompleted ?? 0) + (next.reviewsCompleted ?? 0), perfectLessons: (current.perfectLessons ?? 0) + (next.perfectLessons ?? 0), charactersTyped: (current.charactersTyped ?? 0) + (next.charactersTyped ?? 0), wordsPracticed: (current.wordsPracticed ?? 0) + (next.wordsPracticed ?? 0), sentencesPracticed: (current.sentencesPracticed ?? 0) + (next.sentencesPracticed ?? 0), typingSeconds: (current.typingSeconds ?? 0) + (next.typingSeconds ?? 0), longestSessionSeconds: Math.max(current.longestSessionSeconds ?? 0, next.longestSessionSeconds ?? 0), bestWpm: Math.max(current.bestWpm ?? 0, next.bestWpm ?? 0) }
}
