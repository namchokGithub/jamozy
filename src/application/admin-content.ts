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

const text = z.string().trim().min(1, 'fieldRequired')
const lessonType = z.enum([
  'character',
  'syllable',
  'word',
  'phrase',
  'sentence',
])
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
/** Stable failure codes; the Admin BO maps each to a translated message. */
export type AdminCommandError =
  | 'fieldRequired'
  | 'checkForm'
  | 'parentCourseNotFound'
  | 'parentUnitNotFound'
  | 'publishCourseFirst'
  | 'publishUnitFirst'
  | 'exerciseRequired'
  | 'publishedExerciseRequired'
  | 'oneHomeCourse'
  | 'untypeableText'
  | 'duplicateExerciseId'
  | 'exerciseRemoved'
type AdminCommandFailure = {
  ok: false
  error: AdminCommandError
  detail?: string
}

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
    ? { ok: false, error: 'untypeableText', detail: problems.join('; ') }
    : null
}

function validationError(error: z.ZodError): AdminCommandFailure {
  return {
    ok: false,
    error:
      error.issues[0]?.message === 'fieldRequired'
        ? 'fieldRequired'
        : 'checkForm',
  }
}

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

/** Placeholder text from the Admin editor, in the author's interface language. */
export interface DraftText {
  title?: string
  description?: string
}

// New content stores the editor's translated placeholder; blank text falls
// back to English so a draft never saves without a title.
function orDefault(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback
}

export function createDraftCourse(
  repo: AdminContentRepository,
  text: DraftText = {},
) {
  return repo.createCourse({
    title: orDefault(text.title, 'Untitled Course'),
    description: orDefault(text.description, 'Describe this learning path.'),
  })
}

export function createDraftUnit(
  repo: AdminContentRepository,
  courseId: string,
  text: DraftText = {},
) {
  return repo.createUnit({
    courseId,
    title: orDefault(text.title, 'Untitled Unit'),
    description: orDefault(text.description, 'Describe this Unit.'),
  })
}

export function createDraftLesson(
  repo: AdminContentRepository,
  unitId: string,
  text: Pick<DraftText, 'title'> & { type?: string } = {},
) {
  const type = lessonType.safeParse(text.type)
  return repo.createLesson({
    unitId,
    title: orDefault(text.title, 'Untitled Lesson'),
    type: type.success ? type.data : 'word',
  })
}

/** Order commands take every sibling ID in its new order (see repository). */
export function saveCourseOrder(
  repo: AdminContentRepository,
  courseIds: string[],
) {
  return repo.saveCourseOrder(courseIds)
}

export function saveUnitOrder(
  repo: AdminContentRepository,
  courseId: string,
  unitIds: string[],
) {
  return repo.saveUnitOrder(courseId, unitIds)
}

export function saveLessonOrder(
  repo: AdminContentRepository,
  unitId: string,
  lessonIds: string[],
) {
  return repo.saveLessonOrder(unitId, lessonIds)
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
    return { ok: false, error: 'oneHomeCourse' }
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
    return { ok: false, error: 'parentCourseNotFound' }
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
  const parsed = z
    .object({
      title: text,
      unitId: text,
      type: lessonType,
      exercises: z.array(exerciseSchema),
    })
    .safeParse(withTypeableTargetText(input))
  if (!parsed.success) return validationError(parsed.error)
  // Store the parsed fields: the Exercises come from editor JSON, and parsing
  // drops any field the schema does not know.
  const lesson: Lesson = { ...input, ...parsed.data }
  // Saving must not bypass publishLesson's Exercise requirement.
  if (lesson.status === 'published' && lesson.exercises.length === 0)
    return {
      ok: false,
      error: 'publishedExerciseRequired',
    }
  // Learner Progress and ReviewItems reference Exercise IDs, so IDs stay
  // unique and saved Exercises are never removed (DEC-034).
  const ids = new Set(lesson.exercises.map((exercise) => exercise.id))
  if (ids.size !== lesson.exercises.length)
    return { ok: false, error: 'duplicateExerciseId' }
  const saved = await repo.getLessonById(lesson.id)
  if (saved?.exercises.some((exercise) => !ids.has(exercise.id)))
    return { ok: false, error: 'exerciseRemoved' }
  const untypeable = untypeableExercises(lesson.exercises)
  if (untypeable) return untypeable
  if (!(await repo.getUnitById(lesson.unitId)))
    return { ok: false, error: 'parentUnitNotFound' }
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
    return { ok: false, error: 'oneHomeCourse' }
  await repo.saveCourse(published)
  return { ok: true }
}

export async function publishUnit(
  repo: AdminContentRepository,
  unit: Unit,
): Promise<AdminCommandResult> {
  const course = await repo.getCourseById(unit.courseId)
  if (!course || course.status !== 'published')
    return { ok: false, error: 'publishCourseFirst' }
  const { archivedFromStatus: _archivedFromStatus, ...published } = unit
  void _archivedFromStatus
  await repo.saveUnit({ ...published, status: 'published' })
  return { ok: true }
}

function unpublishableExercises(lesson: Lesson): AdminCommandFailure | null {
  if (lesson.exercises.length === 0)
    return { ok: false, error: 'exerciseRequired' }
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
    return { ok: false, error: 'publishUnitFirst' }
  const course = await repo.getCourseById(unit.courseId)
  if (!course || course.status !== 'published')
    return { ok: false, error: 'publishCourseFirst' }
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
    ? { ok: false, error: 'oneHomeCourse' }
    : null
}

// Publishes a Unit and, first, its parent Course when that is not Published.
// Every check runs first, then one atomic batch writes all documents.
export async function publishUnitWithParents(
  repo: AdminContentRepository,
  unit: Unit,
): Promise<AdminCommandResult> {
  const course = await repo.getCourseById(unit.courseId)
  if (!course) return { ok: false, error: 'parentCourseNotFound' }
  const blocked = await unpublishableCourse(repo, course)
  if (blocked) return blocked
  await repo.saveContent({
    courses: course.status === 'published' ? [] : [asPublished(course)],
    units: [asPublished(unit)],
  })
  return { ok: true }
}

// Publishes a Lesson and, top-down, its non-Published Unit and Course.
// Every check runs first, then one atomic batch writes all documents.
export async function publishLessonWithParents(
  repo: AdminContentRepository,
  input: Lesson,
): Promise<AdminCommandResult> {
  const lesson = withTypeableTargetText(input)
  const invalid = unpublishableExercises(lesson)
  if (invalid) return invalid
  const unit = await repo.getUnitById(lesson.unitId)
  if (!unit) return { ok: false, error: 'parentUnitNotFound' }
  const course = await repo.getCourseById(unit.courseId)
  if (!course) return { ok: false, error: 'parentCourseNotFound' }
  const blocked = await unpublishableCourse(repo, course)
  if (blocked) return blocked
  await repo.saveContent({
    courses: course.status === 'published' ? [] : [asPublished(course)],
    units: unit.status === 'published' ? [] : [asPublished(unit)],
    lessons: [asPublished(lesson)],
  })
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
    return { ok: false, error: 'oneHomeCourse' }
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
