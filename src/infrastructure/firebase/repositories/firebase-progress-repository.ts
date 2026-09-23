import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { toProgress, toProgressDoc } from '../mappers/progress-mapper'
import type { ProgressRepository } from '../../../domain/repositories/progress-repository'
import type { Progress } from '../../../domain/models/progress'

function progressDoc(userId: string, lessonId: string) {
  return doc(db, 'users', userId, 'lessonProgress', lessonId)
}

export class FirebaseProgressRepository implements ProgressRepository {
  async getProgress(userId: string, lessonId: string): Promise<Progress | null> {
    const snapshot = await getDoc(progressDoc(userId, lessonId))
    return snapshot.exists() ? toProgress(lessonId, snapshot.data()) : null
  }

  async getAllProgress(userId: string): Promise<Progress[]> {
    const snapshot = await getDocs(
      collection(db, 'users', userId, 'lessonProgress'),
    )
    return snapshot.docs.map((d) => toProgress(d.id, d.data()))
  }

  async saveProgress(userId: string, progress: Progress): Promise<void> {
    await setDoc(
      progressDoc(userId, progress.lessonId),
      toProgressDoc(progress),
    )
  }
}
