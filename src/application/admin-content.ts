import { z } from 'zod'
import {
  archiveContent,
  restoreContent,
  type ContentStatusFields,
  type RestorableContentStatus,
} from '../domain/models/content-status'
import { courseType, type Course } from '../domain/models/course'
import type { Lesson, LessonExercise } from '../domain/models/lesson'
import type { Unit } from '../domain/models/unit'
import type { AdminContentRepository } from '../domain/repositories/admin-content-repository'
import { normalizeHangulText } from '../domain/korean/hangul'
import {
  findUntypeableCharacters,
  formatCharacters,
} from '../domain/korean/target-sequence'

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

export type AdminCommandResult = { ok: true } | AdminCommandFailure
type AdminCommandFailure = { ok: false; error: string; detail?: string }

const UNTYPEABLE_TEXT = 'Target text has characters the keyboard cannot type.'

// Every Exercise must be typeable on the 2-beolsik keymap, or the player
// cannot start it. Lists each offending Exercise by its 1-based position.
function untypeableExercises(
  exercises: LessonExercise[],
): AdminCommandFailure | null {
  const problems = exercises.flatMap((exercise, index) => {
    const chars = findUntypeableCharacters(exercise.targetText)
    return chars.length > 0
      ? [`Exercise ${index + 1}: ${formatCharacters(chars)}`]
      : []
  })
  return problems.length > 0
    ? { ok: false, error: UNTYPEABLE_TEXT, detail: problems.join('; ') }
    : null
}

function validationError(error: z.ZodError): AdminCommandFailure {
  return {
    ok: false,
    error: error.issues[0]?.message ?? 'Please check the form.',
  }
}

const ONE_HOME_COURSE = 'Only one published Home course is allowed.'

// Home plays exactly one published `home` course (DEC-043).
async function conflictsWithPublishedHome(
  repo: AdminContentRepository,
  course: Course,
): Promise<boolean> {
  if (course.status !== 'published' || courseType(course) !== 'home')
    return false
  return (await repo.getCourses()).some(
    (other) =>
      other.id !== course.id &&
      other.status === 'published' &&
      courseType(other) === 'home',
  )
}

export async function saveCourse(
  repo: AdminContentRepository,
  course: Course,
): Promise<AdminCommandResult> {
  const parsed = z
    .object({
      title: text,
      description: text,
      type: z.enum(['learning', 'home']).optional(),
    })
    .safeParse(course)
  if (!parsed.success) return validationError(parsed.error)
  if (await conflictsWithPublishedHome(repo, course))
    return { ok: false, error: ONE_HOME_COURSE }
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

// Pasted Hangul is often conjoining jamo (ᄀ U+1100) that looks like the
// compatibility jamo the keyboard types (ㄱ U+3131); store the typeable form.
// Surrounding whitespace is dropped too: a trailing space would otherwise
// become a Space the learner must type.
function withTypeableTargetText(lesson: Lesson): Lesson {
  return {
    ...lesson,
    exercises: lesson.exercises.map((exercise) => ({
      ...exercise,
      targetText: normalizeHangulText(exercise.targetText).trim(),
    })),
  }
}

export async function saveLesson(
  repo: AdminContentRepository,
  input: Lesson,
): Promise<AdminCommandResult> {
  const lesson = withTypeableTargetText(input)
  const parsed = z
    .object({
      title: text,
      unitId: text,
      type: z.enum(['character', 'syllable', 'word', 'phrase', 'sentence']),
      exercises: z.array(exerciseSchema),
    })
    .safeParse(lesson)
  if (!parsed.success) return validationError(parsed.error)
  // Saving must not bypass publishLesson's Exercise requirement.
  if (lesson.status === 'published' && lesson.exercises.length === 0)
    return {
      ok: false,
      error: 'A published Lesson needs at least one Exercise.',
    }
  const untypeable = untypeableExercises(lesson.exercises)
  if (untypeable) return untypeable
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
  const published: Course = { ...saved, status: 'published' }
  if (await conflictsWithPublishedHome(repo, published))
    return { ok: false, error: ONE_HOME_COURSE }
  await repo.saveCourse(published)
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

function unpublishableExercises(lesson: Lesson): AdminCommandFailure | null {
  if (lesson.exercises.length === 0)
    return { ok: false, error: 'Add at least one Exercise before publishing.' }
  const parsed = z.array(exerciseSchema).safeParse(lesson.exercises)
  if (!parsed.success) return validationError(parsed.error)
  return untypeableExercises(lesson.exercises)
}

export async function publishLesson(
  repo: AdminContentRepository,
  input: Lesson,
): Promise<AdminCommandResult> {
  const lesson = withTypeableTargetText(input)
  const unit = await repo.getUnitById(lesson.unitId)
  if (!unit || unit.status !== 'published')
    return { ok: false, error: 'Publish the parent Unit first.' }
  const course = await repo.getCourseById(unit.courseId)
  if (!course || course.status !== 'published')
    return { ok: false, error: 'Publish the parent Course first.' }
  const invalid = unpublishableExercises(lesson)
  if (invalid) return invalid
  const { archivedFromStatus: _archivedFromStatus, ...published } = lesson
  void _archivedFromStatus
  await repo.saveLesson({ ...published, status: 'published' })
  return { ok: true }
}

function asPublished<T extends ContentStatusFields>(item: T): T {
  const { archivedFromStatus: _archivedFromStatus, ...published } = item
  void _archivedFromStatus
  return { ...published, status: 'published' } as T
}

// Checks a non-Published parent Course could be published, without writing.
async function unpublishableCourse(
  repo: AdminContentRepository,
  course: Course,
): Promise<AdminCommandFailure | null> {
  if (course.status === 'published') return null
  return (await conflictsWithPublishedHome(repo, asPublished(course)))
    ? { ok: false, error: ONE_HOME_COURSE }
    : null
}

// Publishes a Unit and, first, its parent Course when that is not Published.
// Every check runs before the first write, so a rejection changes nothing.
export async function publishUnitWithParents(
  repo: AdminContentRepository,
  unit: Unit,
): Promise<AdminCommandResult> {
  const course = await repo.getCourseById(unit.courseId)
  if (!course) return { ok: false, error: 'Parent Course was not found.' }
  const blocked = await unpublishableCourse(repo, course)
  if (blocked) return blocked
  if (course.status !== 'published') await repo.saveCourse(asPublished(course))
  await repo.saveUnit(asPublished(unit))
  return { ok: true }
}

// Publishes a Lesson and, top-down, its non-Published Unit and Course.
// Every check runs before the first write, so a rejection changes nothing.
export async function publishLessonWithParents(
  repo: AdminContentRepository,
  input: Lesson,
): Promise<AdminCommandResult> {
  const lesson = withTypeableTargetText(input)
  const invalid = unpublishableExercises(lesson)
  if (invalid) return invalid
  const unit = await repo.getUnitById(lesson.unitId)
  if (!unit) return { ok: false, error: 'Parent Unit was not found.' }
  const course = await repo.getCourseById(unit.courseId)
  if (!course) return { ok: false, error: 'Parent Course was not found.' }
  const blocked = await unpublishableCourse(repo, course)
  if (blocked) return blocked
  if (course.status !== 'published') await repo.saveCourse(asPublished(course))
  if (unit.status !== 'published') await repo.saveUnit(asPublished(unit))
  await repo.saveLesson(asPublished(lesson))
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
): Promise<AdminCommandResult> {
  const { archivedFromStatus: _archivedFromStatus, ...restorable } = course
  void _archivedFromStatus
  const restored: Course = { ...restorable, ...restoreContent(course) }
  if (await conflictsWithPublishedHome(repo, restored))
    return { ok: false, error: ONE_HOME_COURSE }
  await repo.saveCourse(restored)
  return { ok: true }
}
export type RestoreResult =
  { ok: true; status: RestorableContentStatus } | AdminCommandFailure

// Restore returns an item to its pre-archive status (DEC-034), except that a
// Unit or Lesson whose ancestors are not all Published comes back as Draft.
function restoredStatus(item: ContentStatusFields): RestorableContentStatus {
  const { status } = restoreContent(item)
  return status === 'published' ? 'published' : 'draft'
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
): Promise<RestoreResult> {
  const { archivedFromStatus: _archivedFromStatus, ...restorable } = unit
  void _archivedFromStatus
  let status = restoredStatus(unit)
  if (status === 'published') {
    const course = await repo.getCourseById(unit.courseId)
    if (course?.status !== 'published') status = 'draft'
  }
  await repo.saveUnit({ ...restorable, status })
  return { ok: true, status }
}
export async function archiveLesson(
  repo: AdminContentRepository,
  lesson: Lesson,
): Promise<void> {
  await repo.saveLesson({ ...lesson, ...archiveContent(lesson) })
}
export async function restoreLesson(
  repo: AdminContentRepository,
  input: Lesson,
): Promise<RestoreResult> {
  const lesson = withTypeableTargetText(input)
  const { archivedFromStatus: _archivedFromStatus, ...restorable } = lesson
  void _archivedFromStatus
  let status = restoredStatus(lesson)
  if (status === 'published') {
    const unit = await repo.getUnitById(lesson.unitId)
    const course = unit ? await repo.getCourseById(unit.courseId) : null
    if (unit?.status !== 'published' || course?.status !== 'published')
      status = 'draft'
  }
  if (status === 'published') {
    // A Lesson edited while archived must still pass the publish checks.
    const invalid = unpublishableExercises(lesson)
    if (invalid) return invalid
  }
  await repo.saveLesson({ ...restorable, status })
  return { ok: true, status }
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
