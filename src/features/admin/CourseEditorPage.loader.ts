import { getAdminCourseEditor } from '../../application/get-admin-content'
import type { AdminContentRepository } from '../../domain/repositories/admin-content-repository'

export function createCourseEditorLoader(repo: AdminContentRepository) {
  return ({ params }: { params: Record<string, string | undefined> }) =>
    getAdminCourseEditor(repo, params.courseId ?? '')
}
