import type { UserSessionRepository } from '../domain/repositories/user-session-repository'

export function getActiveUserSession(repository: UserSessionRepository) {
  return repository.getActiveSession()
}
