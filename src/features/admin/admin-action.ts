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
} from '../../application/admin-content'
import type { Lesson, LessonExercise } from '../../domain/models/lesson'

export type AdminActionData = { message?: string; error?: string }

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
        return { message: 'Draft Course created.' }
      }
      if (intent === 'create-unit' && params.courseId) {
        await repo.createUnit({
          courseId: params.courseId,
          title: 'Untitled Unit',
          description: 'Describe this Unit.',
        })
        return { message: 'Draft Unit created.' }
      }
      if (intent === 'create-lesson' && params.unitId) {
        await repo.createLesson({
          unitId: params.unitId,
          title: 'Untitled Lesson',
          type: 'word',
        })
        return { message: 'Draft Lesson created.' }
      }
      const id = text(form, 'id')
      const kind = text(form, 'kind')
      if (!id || !kind) return { error: 'Missing content target.' }
      if (kind === 'course') return await courseAction(repo, intent, id, form)
      if (kind === 'unit') return await unitAction(repo, intent, id, form)
      if (kind === 'lesson') return await lessonAction(repo, intent, id, form)
      return { error: 'Unknown content target.' }
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : 'Unable to save content.',
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
  if (!course) return { error: 'Course not found.' }
  if (intent === 'save') {
    const result = await saveCourse(repo, {
      ...course,
      title: text(form, 'title'),
      description: text(form, 'description'),
    })
    return result.ok ? { message: 'Course saved.' } : result
  }
  if (intent === 'publish') {
    await publishCourse(repo, course)
    return { message: 'Course published.' }
  }
  if (intent === 'archive') {
    await archiveCourse(repo, course)
    return { message: 'Course archived.' }
  }
  if (intent === 'restore') {
    await restoreCourse(repo, course)
    return { message: 'Course restored.' }
  }
  return { error: 'Unknown Course action.' }
}

async function unitAction(
  repo: AdminContentRepository,
  intent: string,
  id: string,
  form: FormData,
): Promise<AdminActionData> {
  const unit = await repo.getUnitById(id)
  if (!unit) return { error: 'Unit not found.' }
  if (intent === 'save') {
    const result = await saveUnit(repo, {
      ...unit,
      title: text(form, 'title'),
      description: text(form, 'description'),
    })
    return result.ok ? { message: 'Unit saved.' } : result
  }
  if (intent === 'publish') {
    const result = await publishUnit(repo, unit)
    return result.ok ? { message: 'Unit published.' } : result
  }
  if (intent === 'archive') {
    await archiveUnit(repo, unit)
    return { message: 'Unit archived.' }
  }
  if (intent === 'restore') {
    await restoreUnit(repo, unit)
    return { message: 'Unit restored.' }
  }
  if (intent === 'move-up' || intent === 'move-down') {
    await repo.moveUnit(id, intent === 'move-up' ? 'up' : 'down')
    return { message: 'Unit order updated.' }
  }
  return { error: 'Unknown Unit action.' }
}

function exercisesFromForm(form: FormData): LessonExercise[] {
  const raw = form.get('exercises')
  if (typeof raw !== 'string') return []
  try {
    return JSON.parse(raw) as LessonExercise[]
  } catch {
    return []
  }
}

async function lessonAction(
  repo: AdminContentRepository,
  intent: string,
  id: string,
  form: FormData,
): Promise<AdminActionData> {
  const lesson = await repo.getLessonById(id)
  if (!lesson) return { error: 'Lesson not found.' }
  const updated: Lesson = {
    ...lesson,
    title: text(form, 'title') || lesson.title,
    type: (text(form, 'type') || lesson.type) as Lesson['type'],
    exercises: exercisesFromForm(form).length
      ? exercisesFromForm(form)
      : lesson.exercises,
  }
  if (intent === 'save') {
    const result = await saveLesson(repo, updated)
    return result.ok ? { message: 'Lesson saved.' } : result
  }
  if (intent === 'publish') {
    const result = await publishLesson(repo, updated)
    return result.ok ? { message: 'Lesson published.' } : result
  }
  if (intent === 'archive') {
    await archiveLesson(repo, lesson)
    return { message: 'Lesson archived.' }
  }
  if (intent === 'restore') {
    await restoreLesson(repo, lesson)
    return { message: 'Lesson restored.' }
  }
  if (intent === 'move-up' || intent === 'move-down') {
    await repo.moveLesson(id, intent === 'move-up' ? 'up' : 'down')
    return { message: 'Lesson order updated.' }
  }
  return { error: 'Unknown Lesson action.' }
}
