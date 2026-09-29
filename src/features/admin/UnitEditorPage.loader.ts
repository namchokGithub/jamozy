import type { AdminContentRepository } from '../../domain/repositories/admin-content-repository'
import { NotFoundError } from '../../domain/errors'

export function createUnitEditorLoader(repo: AdminContentRepository) {
  return async ({ params }: { params: Record<string, string | undefined> }) => {
    const unit = await repo.getUnitById(params.unitId ?? '')
    if (!unit) throw new NotFoundError('Unit not found.')
    return {
      unit,
      course: await repo.getCourseById(unit.courseId),
      lessons: await repo.getLessonsByUnitId(unit.id),
    }
  }
}
