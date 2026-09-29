import type { AdminAuthRepository } from '../../domain/repositories/admin-auth-repository'
import { auth } from './firebase'

interface TokenUser {
  getIdTokenResult(
    forceRefresh?: boolean,
  ): Promise<{ claims: Record<string, unknown> }>
}

export class FirebaseAdminAuthRepository implements AdminAuthRepository {
  constructor(
    private readonly getCurrentUser: () => TokenUser | null = () =>
      auth.currentUser,
    private readonly waitForAuthState: () => Promise<void> = () =>
      auth.authStateReady(),
  ) {}

  async isCurrentUserAdmin(): Promise<boolean> {
    await this.waitForAuthState()
    const user = this.getCurrentUser()
    if (!user) return false
    const token = await user.getIdTokenResult()
    return token.claims.admin === true
  }
}
