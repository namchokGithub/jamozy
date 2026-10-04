import type { ActionFunctionArgs } from 'react-router'
import type { AdminContentRepository } from '../../domain/repositories/admin-content-repository'
import {
  archiveCourse,
  archiveLesson,
  archiveUnit,
  publishCourse,
  publishLesson,
  publishUnit,
  restoreCourse,
  restoreLesson,
  restoreUnit,
  saveCourse,
  saveLesson,
  saveUnit,
  type AdminCommandResult,
} from '../../application/admin-content'
import type { Lesson, LessonExercise } from '../../domain/models/lesson'
import type { AdminMessageKey } from './i18n/dictionaries'

/** Keys resolve through the Admin dictionary; `errorDetail` carries untranslated text. */
export type AdminActionData = {
  message?: AdminMessageKey
  error?: AdminMessageKey
  errorDetail?: string
}

const commandErrorKeys: Record<string, AdminMessageKey> = {
  'This field is required.': 'error.fieldRequired',
  'Please check the form.': 'error.checkForm',
  'Parent Course was not found.': 'error.parentCourseNotFound',
  'Parent Unit was not found.': 'error.parentUnitNotFound',
  'Publish the parent Course first.': 'error.publishCourseFirst',
  'Publish the parent Unit first.': 'error.publishUnitFirst',
  'Add at least one Exercise before publishing.': 'error.exerciseRequired',
}

function commandError(error: string): AdminActionData {
  const key = commandErrorKeys[error]
  return key
    ? { error: key }
    : { error: 'error.actionFailed', errorDetail: error }
}

function commandResult(
  result: AdminCommandResult,
  message: AdminMessageKey,
): AdminActionData {
  return result.ok ? { message } : commandError(result.error)
}

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? '').trim()
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
        await repo.createCourse({
          title: 'Untitled Course',
          description: 'Describe this learning path.',
        })
        return { message: 'feedback.courseCreated' }
      }
      if (intent === 'create-unit' && params.courseId) {
        await repo.createUnit({
          courseId: params.courseId,
          title: 'Untitled Unit',
          description: 'Describe this Unit.',
        })
        return { message: 'feedback.unitCreated' }
      }
      if (intent === 'create-lesson' && params.unitId) {
        await repo.createLesson({
          unitId: params.unitId,
          title: 'Untitled Lesson',
          type: 'word',
        })
        return { message: 'feedback.lessonCreated' }
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
  const course = await repo.getCourseById(id)
  if (!course) return { error: 'error.courseNotFound' }
  if (intent === 'save') {
    const result = await saveCourse(repo, {
      ...course,
      title: text(form, 'title'),
      description: text(form, 'description'),
    })
    return commandResult(result, 'feedback.courseSaved')
  }
  if (intent === 'publish') {
    await publishCourse(repo, course)
    return { message: 'feedback.coursePublished' }
  }
  if (intent === 'archive') {
    await archiveCourse(repo, course)
    return { message: 'feedback.courseArchived' }
  }
  if (intent === 'restore') {
    await restoreCourse(repo, course)
    return { message: 'feedback.courseRestored' }
  }
  return { error: 'error.unknownCourseAction' }
}

async function unitAction(
  repo: AdminContentRepository,
  intent: string,
  id: string,
  form: FormData,
): Promise<AdminActionData> {
  const unit = await repo.getUnitById(id)
  if (!unit) return { error: 'error.unitNotFound' }
  if (intent === 'save') {
    const result = await saveUnit(repo, {
      ...unit,
      title: text(form, 'title'),
      description: text(form, 'description'),
    })
    return commandResult(result, 'feedback.unitSaved')
  }
  if (intent === 'publish') {
    const result = await publishUnit(repo, unit)
    return commandResult(result, 'feedback.unitPublished')
  }
  if (intent === 'archive') {
    await archiveUnit(repo, unit)
    return { message: 'feedback.unitArchived' }
  }
  if (intent === 'restore') {
    await restoreUnit(repo, unit)
    return { message: 'feedback.unitRestored' }
  }
  if (intent === 'move-up' || intent === 'move-down') {
    await repo.moveUnit(id, intent === 'move-up' ? 'up' : 'down')
    return { message: 'feedback.unitReordered' }
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
  const lesson = await repo.getLessonById(id)
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
    return commandResult(result, 'feedback.lessonSaved')
  }
  if (intent === 'publish') {
    const result = await publishLesson(repo, lesson)
    return commandResult(result, 'feedback.lessonPublished')
  }
  if (intent === 'archive') {
    await archiveLesson(repo, lesson)
    return { message: 'feedback.lessonArchived' }
  }
  if (intent === 'restore') {
    await restoreLesson(repo, lesson)
    return { message: 'feedback.lessonRestored' }
  }
  if (intent === 'move-up' || intent === 'move-down') {
    await repo.moveLesson(id, intent === 'move-up' ? 'up' : 'down')
    return { message: 'feedback.lessonReordered' }
  }
  return { error: 'error.unknownLessonAction' }
}
