import { getAdminUnitEditor } from '../../application/get-admin-content'
import type { AdminContentRepository } from '../../domain/repositories/admin-content-repository'

export function createUnitEditorLoader(repo: AdminContentRepository) {
  return ({ params }: { params: Record<string, string | undefined> }) =>
    getAdminUnitEditor(repo, params.unitId ?? '')
}
