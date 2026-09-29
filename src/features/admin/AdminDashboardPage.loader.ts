import type { AdminContentRepository } from '../../domain/repositories/admin-content-repository'

export function createAdminDashboardLoader(repo: AdminContentRepository) {
  return async () => ({ courses: await repo.getCourses() })
}
