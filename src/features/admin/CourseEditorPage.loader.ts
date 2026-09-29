import type { AdminContentRepository } from '../../domain/repositories/admin-content-repository'
import { NotFoundError } from '../../domain/errors'

export function createCourseEditorLoader(repo: AdminContentRepository) {
  return async ({ params }: { params: Record<string, string | undefined> }) => {
    const course = await repo.getCourseById(params.courseId ?? '')
    if (!course) throw new NotFoundError('Course not found.')
    return { course, units: await repo.getUnitsByCourseId(course.id) }
  }
}
