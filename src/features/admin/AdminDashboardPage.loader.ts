import { getAdminDashboard } from '../../application/get-admin-content'
import type { AdminContentRepository } from '../../domain/repositories/admin-content-repository'

export function createAdminDashboardLoader(repo: AdminContentRepository) {
  return () => getAdminDashboard(repo)
}
