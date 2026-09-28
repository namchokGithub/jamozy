import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import type { LearningSession } from '../../../domain/models/learning-session'
import type { LearningSessionRepository } from '../../../domain/repositories/learning-session-repository'

const ref = (userId: string, sessionId: string) => doc(db, 'users', userId, 'learningSessions', sessionId)
const toDoc = (s: LearningSession) => ({ context: s.context, startedAt: Timestamp.fromDate(s.startedAt), completedAt: Timestamp.fromDate(s.completedAt), durationSeconds: s.durationSeconds, exercisesAttempted: s.exercisesAttempted, acceptedKeystrokes: s.acceptedKeystrokes, rejectedKeystrokes: s.rejectedKeystrokes, expGained: s.expGained })
const fromDoc = (id: string, d: Record<string, unknown>): LearningSession => ({ id, context: d.context as LearningSession['context'], startedAt: (d.startedAt as Timestamp).toDate(), completedAt: (d.completedAt as Timestamp).toDate(), durationSeconds: d.durationSeconds as number, exercisesAttempted: d.exercisesAttempted as number, acceptedKeystrokes: d.acceptedKeystrokes as number, rejectedKeystrokes: d.rejectedKeystrokes as number, expGained: d.expGained as number })
export class FirebaseLearningSessionRepository implements LearningSessionRepository {
  async getLearningSession(userId: string, sessionId: string) { const snap = await getDoc(ref(userId, sessionId)); return snap.exists() ? fromDoc(snap.id, snap.data()) : null }
  async saveLearningSession(userId: string, session: LearningSession) { await setDoc(ref(userId, session.id), toDoc(session)) }
}
