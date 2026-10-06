import { getAdminLessonEditor } from '../../application/get-admin-content'
import type { AdminContentRepository } from '../../domain/repositories/admin-content-repository'

export function createLessonEditorLoader(repo: AdminContentRepository) {
  return ({ params }: { params: Record<string, string | undefined> }) =>
    getAdminLessonEditor(repo, params.lessonId ?? '')
}
