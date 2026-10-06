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
}

export function sessionAccuracy(session: Pick<LearningSession, 'acceptedKeystrokes' | 'rejectedKeystrokes'>): number {
  const total = session.acceptedKeystrokes + session.rejectedKeystrokes
  return total === 0 ? 0 : (session.acceptedKeystrokes / total) * 100
}

export function sessionWpm(session: Pick<LearningSession, 'acceptedKeystrokes' | 'durationSeconds'>): number {
  return session.durationSeconds === 0 ? 0 : (session.acceptedKeystrokes / 5) / (session.durationSeconds / 60)
}
