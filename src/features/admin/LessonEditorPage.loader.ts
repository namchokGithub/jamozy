import type { AdminContentRepository } from '../../domain/repositories/admin-content-repository'
import { NotFoundError } from '../../domain/errors'

export function createLessonEditorLoader(repo: AdminContentRepository) {
  return async ({ params }: { params: Record<string, string | undefined> }) => {
    const lesson = await repo.getLessonById(params.lessonId ?? '')
    if (!lesson) throw new NotFoundError('Lesson not found.')
    const unit = await repo.getUnitById(lesson.unitId)
    return {
      lesson,
      unit,
      course: unit ? await repo.getCourseById(unit.courseId) : null,
    }
  }
}
