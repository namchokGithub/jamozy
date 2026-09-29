import type { AdminAuthRepository } from '../../domain/repositories/admin-auth-repository'

export class UnauthorizedError extends Error {
  constructor() {
    super('You are not authorized to manage content.')
  }
}

export function createAdminGuardLoader(auth: AdminAuthRepository) {
  return async () => {
    if (!(await auth.isCurrentUserAdmin())) throw new UnauthorizedError()
    return null
  }
}

export function requireAdmin<TArgs extends unknown[], TResult>(
  auth: AdminAuthRepository,
  handler: (...args: TArgs) => TResult | Promise<TResult>,
) {
  const guard = createAdminGuardLoader(auth)
  return async (...args: TArgs): Promise<TResult> => {
    await guard()
    return handler(...args)
  }
}
