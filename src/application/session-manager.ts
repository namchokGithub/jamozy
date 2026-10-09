import type { UserSession } from '../domain/models/user-session'
import type { AuthRepository } from '../domain/repositories/auth-repository'
import type { UserSessionRepository } from '../domain/repositories/user-session-repository'

export class SessionManager implements UserSessionRepository {
  constructor(
    private auth: AuthRepository,
    private guest: UserSessionRepository,
  ) {}
  async getActiveSession(): Promise<UserSession> {
    await this.auth.waitForInitialAuthState()
    const user = this.auth.getCurrentUser()
    return user
      ? { kind: 'authenticated', userId: user.uid }
      : this.guest.getActiveSession()
  }
  onChange(listener: () => void): () => void {
    return this.auth.onAuthStateChanged(() => listener())
  }
}
