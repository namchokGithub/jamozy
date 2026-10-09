import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { UserProfileRepository } from '../../../domain/repositories/user-profile-repository'
import {
  defaultUserProfile,
  normalizeUserSettings,
  type UserProfile,
} from '../../../domain/models/user-profile'
import type { PlayerStats } from '../../../domain/models/player-stats'

export function toUserProfile(id: string, data: Record<string, unknown>): UserProfile {
  // A profile doc can lack these (an older shape); read them as a new
  // profile's defaults rather than undefined.
  const defaults = defaultUserProfile(id, new Date(0))
  return {
    id,
    displayName: typeof data.displayName === 'string' ? data.displayName : 'Guest',
    exp: typeof data.exp === 'number' ? data.exp : 0,
    settings: normalizeUserSettings(
      (data.settings as UserProfile['settings'] | undefined) ?? defaults.settings,
    ),
    stats: (data.stats as UserProfile['stats'] | undefined) ?? defaults.stats,
    legacyBaseline: data.legacyBaseline as UserProfile['legacyBaseline'],
    sessionAggregate: data.sessionAggregate as UserProfile['sessionAggregate'],
    timezone: typeof data.timezone === 'string' ? data.timezone : undefined,
    playerStats: data.playerStats as PlayerStats | undefined,
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
    ...(profile.timezone ? { timezone: profile.timezone } : {}),
    ...(profile.playerStats ? { playerStats: profile.playerStats } : {}),
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
