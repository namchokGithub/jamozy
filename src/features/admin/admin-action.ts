import type { ActionFunctionArgs } from 'react-router'
import type { AdminContentRepository } from '../../domain/repositories/admin-content-repository'
import {
  archiveCourse,
  archiveLesson,
  archiveUnit,
  createDraftCourse,
  createDraftLesson,
  createDraftUnit,
  publishCourse,
  publishLesson,
  publishLessonWithParents,
  publishUnit,
  publishUnitWithParents,
  restoreCourse,
  restoreLesson,
  restoreUnit,
  saveCourse,
  saveCourseOrder,
  saveLesson,
  saveLessonOrder,
  saveUnit,
  saveUnitOrder,
  type AdminCommandResult,
} from '../../application/admin-content'
import {
  getAdminCourse,
  getAdminLesson,
  getAdminUnit,
} from '../../application/get-admin-content'
import type { Lesson, LessonExercise } from '../../domain/models/lesson'
import type { AdminMessageKey } from './i18n/dictionaries'

/** Keys resolve through the Admin dictionary; `errorDetail` carries untranslated text. */
export type AdminActionData = {
  message?: AdminMessageKey
  error?: AdminMessageKey
  errorDetail?: string
  createdId?: string
}

function commandResult(
  result: AdminCommandResult,
  message: AdminMessageKey,
): AdminActionData {
  if (result.ok) return { message }
  const data: AdminActionData = { error: `error.${result.error}` }
  return result.detail ? { ...data, errorDetail: result.detail } : data
}

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? '').trim()
}

function parseOrder(value: FormDataEntryValue | null): string[] | null {
  if (typeof value !== 'string') return null
  try {
    const order = JSON.parse(value)
    return Array.isArray(order) && order.every((id) => typeof id === 'string')
      ? order
      : null
  } catch {
    return null
  }
}

export function createAdminAction(repo: AdminContentRepository) {
  return async ({
    request,
    params,
  }: ActionFunctionArgs): Promise<AdminActionData> => {
    const form = await request.formData()
    const intent = text(form, 'intent')
    try {
      if (intent === 'create-course') {
        const created = await createDraftCourse(repo, {
          title: text(form, 'title'),
          description: text(form, 'description'),
        })
        return { message: 'feedback.courseCreated', createdId: created.id }
      }
      if (intent === 'create-unit' && params.courseId) {
        const created = await createDraftUnit(repo, params.courseId, {
          title: text(form, 'title'),
          description: text(form, 'description'),
        })
        return { message: 'feedback.unitCreated', createdId: created.id }
      }
      if (intent === 'create-lesson' && params.unitId) {
        const created = await createDraftLesson(repo, params.unitId, {
          title: text(form, 'title'),
        })
        return { message: 'feedback.lessonCreated', createdId: created.id }
      }
      if (intent === 'save-course-order') {
        const order = parseOrder(form.get('order'))
        if (!order) return { error: 'error.checkForm' }
        await saveCourseOrder(repo, order)
        return { message: 'feedback.courseReordered' }
      }
      if (intent === 'save-unit-order' && params.courseId) {
        const order = parseOrder(form.get('order'))
        if (!order) return { error: 'error.checkForm' }
        await saveUnitOrder(repo, params.courseId, order)
        return { message: 'feedback.unitReordered' }
      }
      if (intent === 'save-lesson-order' && params.unitId) {
        const order = parseOrder(form.get('order'))
        if (!order) return { error: 'error.checkForm' }
        await saveLessonOrder(repo, params.unitId, order)
        return { message: 'feedback.lessonReordered' }
      }
      const id = text(form, 'id')
      const kind = text(form, 'kind')
      if (!id || !kind) return { error: 'error.missingTarget' }
      if (kind === 'course') return await courseAction(repo, intent, id, form)
      if (kind === 'unit') return await unitAction(repo, intent, id, form)
      if (kind === 'lesson') return await lessonAction(repo, intent, id, form)
      return { error: 'error.unknownTarget' }
    } catch (error) {
      return {
        error: 'error.actionFailed',
        errorDetail: error instanceof Error ? error.message : undefined,
      }
    }
  }
}

async function courseAction(
  repo: AdminContentRepository,
  intent: string,
  id: string,
  form: FormData,
): Promise<AdminActionData> {
  const course = await getAdminCourse(repo, id)
  if (!course) return { error: 'error.courseNotFound' }
  if (intent === 'save') {
    const result = await saveCourse(repo, {
      ...course,
      title: text(form, 'title'),
      description: text(form, 'description'),
      type: text(form, 'type') === 'home' ? 'home' : 'learning',
    })
    return commandResult(result, 'feedback.changesSaved')
  }
  if (intent === 'publish') {
    return commandResult(
      await publishCourse(repo, course),
      'feedback.coursePublished',
    )
  }
  if (intent === 'archive') {
    await archiveCourse(repo, course)
    return { message: 'feedback.courseArchived' }
  }
  if (intent === 'restore') {
    return commandResult(
      await restoreCourse(repo, course),
      'feedback.courseRestored',
    )
  }
  return { error: 'error.unknownCourseAction' }
}

async function unitAction(
  repo: AdminContentRepository,
  intent: string,
  id: string,
  form: FormData,
): Promise<AdminActionData> {
  const unit = await getAdminUnit(repo, id)
  if (!unit) return { error: 'error.unitNotFound' }
  if (intent === 'save') {
    const result = await saveUnit(repo, {
      ...unit,
      title: text(form, 'title'),
      description: text(form, 'description'),
    })
    return commandResult(result, 'feedback.changesSaved')
  }
  if (intent === 'publish') {
    const result = await publishUnit(repo, unit)
    return commandResult(result, 'feedback.unitPublished')
  }
  if (intent === 'publish-with-parents') {
    const result = await publishUnitWithParents(repo, unit)
    return commandResult(result, 'feedback.unitPublished')
  }
  if (intent === 'archive') {
    await archiveUnit(repo, unit)
    return { message: 'feedback.unitArchived' }
  }
  if (intent === 'restore') {
    const result = await restoreUnit(repo, unit)
    return commandResult(
      result,
      result.ok &&
        result.status === 'draft' &&
        unit.archivedFromStatus === 'published'
        ? 'feedback.unitRestoredAsDraft'
        : 'feedback.unitRestored',
    )
  }
  return { error: 'error.unknownUnitAction' }
}

function exercisesFromForm(form: FormData): LessonExercise[] | null {
  const raw = form.get('exercises')
  if (typeof raw !== 'string') return null
  try {
    return JSON.parse(raw) as LessonExercise[]
  } catch {
    return null
  }
}

async function lessonAction(
  repo: AdminContentRepository,
  intent: string,
  id: string,
  form: FormData,
): Promise<AdminActionData> {
  const lesson = await getAdminLesson(repo, id)
  if (!lesson) return { error: 'error.lessonNotFound' }
  if (intent === 'save') {
    const exercises = exercisesFromForm(form)
    if (!exercises) return { error: 'error.checkForm' }
    const updated: Lesson = {
      ...lesson,
      title: text(form, 'title'),
      type: text(form, 'type') as Lesson['type'],
      exercises,
    }
    const result = await saveLesson(repo, updated)
    return commandResult(result, 'feedback.changesSaved')
  }
  if (intent === 'publish') {
    const result = await publishLesson(repo, lesson)
    return commandResult(result, 'feedback.lessonPublished')
  }
  if (intent === 'publish-with-parents') {
    const result = await publishLessonWithParents(repo, lesson)
    return commandResult(result, 'feedback.lessonPublished')
  }
  if (intent === 'archive') {
    await archiveLesson(repo, lesson)
    return { message: 'feedback.lessonArchived' }
  }
  if (intent === 'restore') {
    const result = await restoreLesson(repo, lesson)
    return commandResult(
      result,
      result.ok &&
        result.status === 'draft' &&
        lesson.archivedFromStatus === 'published'
        ? 'feedback.lessonRestoredAsDraft'
        : 'feedback.lessonRestored',
    )
  }
  return { error: 'error.unknownLessonAction' }
}
