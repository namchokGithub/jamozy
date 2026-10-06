import { NotFoundError } from '../domain/errors'
import type { Course } from '../domain/models/course'
import type { Lesson } from '../domain/models/lesson'
import type { Unit } from '../domain/models/unit'
import type { AdminContentRepository } from '../domain/repositories/admin-content-repository'

// Admin BO reads include every status (Draft, Published, Archived); learner
// reads go through the content repositories instead.

export function getAdminCourse(
  repo: AdminContentRepository,
  courseId: string,
): Promise<Course | null> {
  return repo.getCourseById(courseId)
}

export function getAdminUnit(
  repo: AdminContentRepository,
  unitId: string,
): Promise<Unit | null> {
  return repo.getUnitById(unitId)
}

export function getAdminLesson(
  repo: AdminContentRepository,
  lessonId: string,
): Promise<Lesson | null> {
  return repo.getLessonById(lessonId)
}

export async function getAdminDashboard(
  repo: AdminContentRepository,
): Promise<{ courses: Course[] }> {
  return { courses: await repo.getCourses() }
}

export async function getAdminCourseEditor(
  repo: AdminContentRepository,
  courseId: string,
): Promise<{ course: Course; units: Unit[] }> {
  const [course, units] = await Promise.all([
    repo.getCourseById(courseId),
    repo.getUnitsByCourseId(courseId),
  ])
  if (!course) throw new NotFoundError('Course not found.')
  return { course, units }
}

export async function getAdminUnitEditor(
  repo: AdminContentRepository,
  unitId: string,
): Promise<{ unit: Unit; course: Course | null; lessons: Lesson[] }> {
  const [unit, lessons] = await Promise.all([
    repo.getUnitById(unitId),
    repo.getLessonsByUnitId(unitId),
  ])
  if (!unit) throw new NotFoundError('Unit not found.')
  return { unit, course: await repo.getCourseById(unit.courseId), lessons }
}

export async function getAdminLessonEditor(
  repo: AdminContentRepository,
  lessonId: string,
): Promise<{ lesson: Lesson; unit: Unit | null; course: Course | null }> {
  const lesson = await repo.getLessonById(lessonId)
  if (!lesson) throw new NotFoundError('Lesson not found.')
  const unit = await repo.getUnitById(lesson.unitId)
  return {
    lesson,
    unit,
    course: unit ? await repo.getCourseById(unit.courseId) : null,
  }
}
