export type LearningSessionContext =
  | { mode: 'learning-path'; lessonId: string }
  | { mode: 'home'; lessonId: string }
  | { mode: 'review' }

export interface LearningSession {
  id: string
  context: LearningSessionContext
  startedAt: Date
  completedAt: Date
  durationSeconds: number
  exercisesAttempted: number
  acceptedKeystrokes: number
  rejectedKeystrokes: number
  expGained: number
  // Player stats (DEC-049); absent on sessions before it.
  localDate?: string
  // Player stats (DEC-049); absent on sessions before it.
  timeZone?: string
  // Player stats (DEC-049); absent on sessions before it.
  typingSeconds?: number
  // Player stats (DEC-049); absent on sessions before it.
  learningSeconds?: number
  // Player stats (DEC-049); absent on sessions before it.
  charactersTyped?: number
  // Player stats (DEC-049); absent on sessions before it.
  wordsPracticed?: number
  // Player stats (DEC-049); absent on sessions before it.
  sentencesPracticed?: number
  // Player stats (DEC-049); absent on sessions before it.
  exerciseMistakes?: number[]
  // Player stats (DEC-049); absent on sessions before it.
  isReplay?: boolean
}

export function sessionAccuracy(session: Pick<LearningSession, 'acceptedKeystrokes' | 'rejectedKeystrokes'>): number {
  const total = session.acceptedKeystrokes + session.rejectedKeystrokes
  return total === 0 ? 0 : (session.acceptedKeystrokes / total) * 100
}

export function sessionWpm(session: Pick<LearningSession, 'acceptedKeystrokes' | 'durationSeconds'>): number {
  return session.durationSeconds === 0 ? 0 : (session.acceptedKeystrokes / 5) / (session.durationSeconds / 60)
}
