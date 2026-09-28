import { createGuestIdentity, type GuestSession, type UserSession } from '../../domain/models/user-session'
import type { UserSessionRepository } from '../../domain/repositories/user-session-repository'
import { defaultUserProfile } from '../../domain/models/user-profile'
import type { UserProfileRepository } from '../../domain/repositories/user-profile-repository'
import { GuestDatabase, guestDatabase } from './guest-database'

const ACTIVE_KEY = 'active'

export class GuestSessionRepository implements UserSessionRepository {
  constructor(private database: GuestDatabase = guestDatabase, private cryptoApi: Crypto = crypto, private profiles?: UserProfileRepository) {}
  async getActiveSession(): Promise<UserSession> {
    const existing = await this.database.get<GuestSession>('guestSessions', ACTIVE_KEY)
    if (existing) return { kind: 'guest', userId: existing.guestId }
    const identity = createGuestIdentity(this.cryptoApi)
    const now = new Date()
    const session: GuestSession = { ...identity, createdAt: now, lastActiveAt: now }
    await this.database.put('guestSessions', ACTIVE_KEY, session)
    if (this.profiles) await this.profiles.saveUserProfile(identity.guestId, defaultUserProfile(identity.guestId, now, identity.displayName))
    return { kind: 'guest', userId: identity.guestId }
  }
}
