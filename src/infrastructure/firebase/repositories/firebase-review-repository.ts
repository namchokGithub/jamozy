import { collection, doc, getDocs, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { ReviewRepository } from '../../../domain/repositories/review-repository'
import type { ReviewItem } from '../../../domain/models/review-item'

function toReviewItem(id: string, data: Record<string, unknown>): ReviewItem {
  return {
    id,
    sourceLessonId: data.sourceLessonId as string,
    sourceExerciseId: data.sourceExerciseId as string,
    targetText: data.targetText as string,
    mistakeCount: data.mistakeCount as number,
    lastMistakeAt: (data.lastMistakeAt as { toDate(): Date }).toDate(),
    resolved: data.resolved as boolean,
  }
}

export class FirebaseReviewRepository implements ReviewRepository {
  async getReviewItems(userId: string): Promise<ReviewItem[]> {
    const snapshot = await getDocs(
      collection(db, 'users', userId, 'reviewItems'),
    )
    return snapshot.docs.map((d) => toReviewItem(d.id, d.data()))
  }

  async addReviewItem(userId: string, item: ReviewItem): Promise<void> {
    await setDoc(doc(db, 'users', userId, 'reviewItems', item.id), {
      sourceLessonId: item.sourceLessonId,
      sourceExerciseId: item.sourceExerciseId,
      targetText: item.targetText,
      mistakeCount: item.mistakeCount,
      lastMistakeAt: Timestamp.fromDate(item.lastMistakeAt),
      resolved: item.resolved,
    })
  }

  async markResolved(userId: string, itemId: string): Promise<void> {
    await updateDoc(doc(db, 'users', userId, 'reviewItems', itemId), {
      resolved: true,
    })
  }
}
