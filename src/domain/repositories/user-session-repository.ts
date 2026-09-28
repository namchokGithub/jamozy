import type { UserSession } from '../models/user-session'

export interface UserSessionRepository {
  getActiveSession(): Promise<UserSession>
}
