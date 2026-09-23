import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { UserProfileRepository } from '../../../domain/repositories/user-profile-repository'
import type { UserProfile } from '../../../domain/models/user-profile'

function toUserProfile(id: string, data: Record<string, unknown>): UserProfile {
  return {
    id,
    exp: data.exp as number,
    settings: data.settings as UserProfile['settings'],
    stats: data.stats as UserProfile['stats'],
    createdAt: (data.createdAt as { toDate(): Date }).toDate(),
  }
}

function toUserProfileDoc(profile: UserProfile) {
  return {
    exp: profile.exp,
    settings: profile.settings,
    stats: profile.stats,
    createdAt: profile.createdAt,
  }
}

export class FirebaseUserProfileRepository implements UserProfileRepository {
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const snapshot = await getDoc(doc(db, 'users', userId))
    return snapshot.exists()
      ? toUserProfile(snapshot.id, snapshot.data())
      : null
  }

  async saveUserProfile(userId: string, profile: UserProfile): Promise<void> {
    await setDoc(doc(db, 'users', userId), toUserProfileDoc(profile))
  }
}
