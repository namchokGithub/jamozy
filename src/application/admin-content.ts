import { z } from 'zod'
import { archiveContent, restoreContent } from '../domain/models/content-status'
import type { Course } from '../domain/models/course'
import type { Lesson, LessonExercise } from '../domain/models/lesson'
import type { Unit } from '../domain/models/unit'
import type { AdminContentRepository } from '../domain/repositories/admin-content-repository'

const text = z.string().trim().min(1, 'This field is required.')
const exerciseSchema = z.object({
  id: text,
  targetText: text,
  romanization: z.string().nullable(),
  meaningTh: z.string(),
  meaningEn: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  hint: z.string().nullable(),
})

export type AdminCommandResult = { ok: true } | { ok: false; error: string }

function validationError(error: z.ZodError): AdminCommandResult {
  return {
    ok: false,
    error: error.issues[0]?.message ?? 'Please check the form.',
  }
}

export async function saveCourse(
  repo: AdminContentRepository,
  course: Course,
): Promise<AdminCommandResult> {
  const parsed = z.object({ title: text, description: text }).safeParse(course)
  if (!parsed.success) return validationError(parsed.error)
  await repo.saveCourse(course)
  return { ok: true }
}

export async function saveUnit(
  repo: AdminContentRepository,
  unit: Unit,
): Promise<AdminCommandResult> {
  const parsed = z
    .object({ title: text, description: text, courseId: text })
    .safeParse(unit)
  if (!parsed.success) return validationError(parsed.error)
  if (!(await repo.getCourseById(unit.courseId)))
    return { ok: false, error: 'Parent Course was not found.' }
  await repo.saveUnit(unit)
  return { ok: true }
}

export async function saveLesson(
  repo: AdminContentRepository,
  lesson: Lesson,
): Promise<AdminCommandResult> {
  const parsed = z
    .object({
      title: text,
      unitId: text,
      type: z.enum(['character', 'syllable', 'word', 'phrase', 'sentence']),
      exercises: z.array(exerciseSchema),
    })
    .safeParse(lesson)
  if (!parsed.success) return validationError(parsed.error)
  if (!(await repo.getUnitById(lesson.unitId)))
    return { ok: false, error: 'Parent Unit was not found.' }
  await repo.saveLesson(lesson)
  return { ok: true }
}

export async function publishCourse(
  repo: AdminContentRepository,
  course: Course,
): Promise<AdminCommandResult> {
  const { archivedFromStatus: _archivedFromStatus, ...saved } = course
  void _archivedFromStatus
  await repo.saveCourse({ ...saved, status: 'published' })
  return { ok: true }
}

export async function publishUnit(
  repo: AdminContentRepository,
  unit: Unit,
): Promise<AdminCommandResult> {
  const course = await repo.getCourseById(unit.courseId)
  if (!course || course.status !== 'published')
    return { ok: false, error: 'Publish the parent Course first.' }
  const { archivedFromStatus: _archivedFromStatus, ...published } = unit
  void _archivedFromStatus
  await repo.saveUnit({ ...published, status: 'published' })
  return { ok: true }
}

export async function publishLesson(
  repo: AdminContentRepository,
  lesson: Lesson,
): Promise<AdminCommandResult> {
  const unit = await repo.getUnitById(lesson.unitId)
  if (!unit || unit.status !== 'published')
    return { ok: false, error: 'Publish the parent Unit first.' }
  const course = await repo.getCourseById(unit.courseId)
  if (!course || course.status !== 'published')
    return { ok: false, error: 'Publish the parent Course first.' }
  if (lesson.exercises.length === 0)
    return { ok: false, error: 'Add at least one Exercise before publishing.' }
  const parsed = z.array(exerciseSchema).safeParse(lesson.exercises)
  if (!parsed.success) return validationError(parsed.error)
  const { archivedFromStatus: _archivedFromStatus, ...published } = lesson
  void _archivedFromStatus
  await repo.saveLesson({ ...published, status: 'published' })
  return { ok: true }
}

export async function archiveCourse(
  repo: AdminContentRepository,
  course: Course,
): Promise<void> {
  await repo.saveCourse({ ...course, ...archiveContent(course) })
}
export async function restoreCourse(
  repo: AdminContentRepository,
  course: Course,
): Promise<void> {
  const { archivedFromStatus: _archivedFromStatus, ...restorable } = course
  void _archivedFromStatus
  await repo.saveCourse({ ...restorable, ...restoreContent(course) })
}
export async function archiveUnit(
  repo: AdminContentRepository,
  unit: Unit,
): Promise<void> {
  await repo.saveUnit({ ...unit, ...archiveContent(unit) })
}
export async function restoreUnit(
  repo: AdminContentRepository,
  unit: Unit,
): Promise<void> {
  const { archivedFromStatus: _archivedFromStatus, ...restorable } = unit
  void _archivedFromStatus
  await repo.saveUnit({ ...restorable, ...restoreContent(unit) })
}
export async function archiveLesson(
  repo: AdminContentRepository,
  lesson: Lesson,
): Promise<void> {
  await repo.saveLesson({ ...lesson, ...archiveContent(lesson) })
}
export async function restoreLesson(
  repo: AdminContentRepository,
  lesson: Lesson,
): Promise<void> {
  const { archivedFromStatus: _archivedFromStatus, ...restorable } = lesson
  void _archivedFromStatus
  await repo.saveLesson({ ...restorable, ...restoreContent(lesson) })
}

export function makeExercise(id: string): LessonExercise {
  return {
    id,
    targetText: '',
    romanization: null,
    meaningTh: '',
    meaningEn: '',
    difficulty: 'easy',
    hint: null,
  }
}
