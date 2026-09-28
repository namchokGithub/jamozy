import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { UserProfileRepository } from '../../../domain/repositories/user-profile-repository'
import type { UserProfile } from '../../../domain/models/user-profile'

export function toUserProfile(id: string, data: Record<string, unknown>): UserProfile {
  return {
    id,
    displayName: typeof data.displayName === 'string' ? data.displayName : 'Guest',
    exp: data.exp as number,
    settings: data.settings as UserProfile['settings'],
    stats: data.stats as UserProfile['stats'],
    legacyBaseline: data.legacyBaseline as UserProfile['legacyBaseline'],
    sessionAggregate: data.sessionAggregate as UserProfile['sessionAggregate'],
    createdAt: (data.createdAt as { toDate(): Date }).toDate(),
    updatedAt: data.updatedAt
      ? (data.updatedAt as { toDate(): Date }).toDate()
      : (data.createdAt as { toDate(): Date }).toDate(),
  }
}

export function toUserProfileDoc(profile: UserProfile) {
  return {
    displayName: profile.displayName ?? 'Guest',
    exp: profile.exp,
    settings: profile.settings,
    stats: profile.stats,
    ...(profile.legacyBaseline ? { legacyBaseline: profile.legacyBaseline } : {}),
    ...(profile.sessionAggregate ? { sessionAggregate: profile.sessionAggregate } : {}),
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt ?? profile.createdAt,
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
