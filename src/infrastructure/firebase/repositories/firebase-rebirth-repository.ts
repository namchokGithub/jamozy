import { doc, runTransaction } from 'firebase/firestore'
import { db } from '../firebase'
import { rebirthProfile, type RebirthRecord, type RebirthResult } from '../../../domain/models/rebirth'
import type { RebirthRepository } from '../../../domain/repositories/rebirth-repository'
import { toUserProfile, toUserProfileDoc } from './firebase-user-profile-repository'

export class FirebaseRebirthRepository implements RebirthRepository {
  async rebirth(userId: string, operationId: string, now: Date): Promise<RebirthResult> {
    return runTransaction(db, async (transaction) => {
      const recordRef = doc(db, 'users', userId, 'rebirths', operationId)
      const existing = await transaction.get(recordRef)
      if (existing.exists()) return { status: 'already-applied', record: existing.data() as RebirthRecord }
      const profileRef = doc(db, 'users', userId)
      const profileSnapshot = await transaction.get(profileRef)
      if (!profileSnapshot.exists()) throw new Error('User profile is required')
      const result = rebirthProfile(toUserProfile(userId, profileSnapshot.data()), operationId, now)
      if ('level' in result) return { status: 'ineligible', level: result.level }
      transaction.set(profileRef, toUserProfileDoc(result.profile))
      transaction.set(recordRef, result.record)
      return { status: 'rebirthed', record: result.record }
    })
  }
}
