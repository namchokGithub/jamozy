import { describe, expect, it } from 'vitest'
import { archiveCourse, publishLesson, restoreCourse } from './admin-content'
import { FakeAdminContentRepository } from '../test/fakes'
import { createAdminAction } from '../features/admin/admin-action'
import type { Course } from '../domain/models/course'
import type { Unit } from '../domain/models/unit'
import type { Lesson } from '../domain/models/lesson'

const now = new Date('2026-09-29')
const course: Course = {
  id: 'course',
  title: 'Course',
  description: 'Description',
  order: 0,
  status: 'published',
  createdAt: now,
  updatedAt: now,
}
const unit: Unit = {
  id: 'unit',
  courseId: 'course',
  title: 'Unit',
  description: 'Description',
  order: 0,
  status: 'published',
  createdAt: now,
  updatedAt: now,
}
function lesson(
  exercises: Lesson['exercises'],
  status: Lesson['status'] = 'draft',
): Lesson {
  return {
    id: 'lesson',
    unitId: 'unit',
    title: 'Lesson',
    type: 'word',
    order: 0,
    status,
    exercises,
    createdAt: now,
    updatedAt: now,
  }
}

function lessonSaveRequest(fields: Record<string, string>): Request {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) form.set(name, value)
  return new Request('https://jamozy.test/admin/lessons/lesson', {
    method: 'POST',
    body: form,
  })
}

describe('admin content lifecycle', () => {
  it('does not replace an empty lesson exercise list with the saved exercises', async () => {
    const existingExercise = {
      id: 'exercise',
      targetText: '가',
      romanization: null,
      meaningTh: '',
      meaningEn: '',
      difficulty: 'easy' as const,
      hint: null,
    }
    const repo = new FakeAdminContentRepository(
      [course],
      [unit],
      [lesson([existingExercise])],
    )

    const result = await createAdminAction(repo)({
      request: lessonSaveRequest({
        intent: 'save',
        kind: 'lesson',
        id: 'lesson',
        title: 'Lesson',
        type: 'word',
        exercises: '[]',
      }),
      params: {},
    } as never)

    expect(result).toEqual({ message: 'feedback.lessonSaved' })
    expect((await repo.getLessonById('lesson'))?.exercises).toEqual([])
  })

  it('rejects an empty lesson title instead of retaining the saved title', async () => {
    const repo = new FakeAdminContentRepository([course], [unit], [lesson([])])

    const result = await createAdminAction(repo)({
      request: lessonSaveRequest({
        intent: 'save',
        kind: 'lesson',
        id: 'lesson',
        title: '',
        type: 'word',
        exercises: '[]',
      }),
      params: {},
    } as never)

    expect(result).toEqual({ error: 'error.fieldRequired' })
    expect((await repo.getLessonById('lesson'))?.title).toBe('Lesson')
  })

  it('rejects malformed lesson exercises instead of clearing saved exercises', async () => {
    const existingExercise = {
      id: 'exercise',
      targetText: '가',
      romanization: null,
      meaningTh: '',
      meaningEn: '',
      difficulty: 'easy' as const,
      hint: null,
    }
    const repo = new FakeAdminContentRepository(
      [course],
      [unit],
      [lesson([existingExercise])],
    )

    const result = await createAdminAction(repo)({
      request: lessonSaveRequest({
        intent: 'save',
        kind: 'lesson',
        id: 'lesson',
        title: 'Lesson',
        type: 'word',
        exercises: '{invalid-json}',
      }),
      params: {},
    } as never)

    expect(result).toEqual({ error: 'error.checkForm' })
    expect((await repo.getLessonById('lesson'))?.exercises).toEqual([
      existingExercise,
    ])
  })

  it('archives a lesson without requiring editor form fields', async () => {
    const repo = new FakeAdminContentRepository([course], [unit], [lesson([])])

    const result = await createAdminAction(repo)({
      request: lessonSaveRequest({
        intent: 'archive',
        kind: 'lesson',
        id: 'lesson',
      }),
      params: {},
    } as never)

    expect(result).toEqual({ message: 'feedback.lessonArchived' })
    expect((await repo.getLessonById('lesson'))?.status).toBe('archived')
  })

  it('blocks publishing a Lesson without an Exercise', async () => {
    const repo = new FakeAdminContentRepository([course], [unit], [lesson([])])
    await expect(publishLesson(repo, lesson([]))).resolves.toEqual({
      ok: false,
      error: 'Add at least one Exercise before publishing.',
    })
    expect((await repo.getLessonById('lesson'))?.status).toBe('draft')
  })

  it('blocks publishing a Lesson below a non-published parent', async () => {
    const repo = new FakeAdminContentRepository(
      [{ ...course, status: 'draft' }],
      [unit],
      [
        lesson([
          {
            id: 'exercise',
            targetText: '가',
            romanization: null,
            meaningTh: '',
            meaningEn: '',
            difficulty: 'easy',
            hint: null,
          },
        ]),
      ],
    )
    await expect(
      publishLesson(repo, (await repo.getLessonById('lesson'))!),
    ).resolves.toEqual({ ok: false, error: 'Publish the parent Course first.' })
  })

  it('restores an archived draft Course as draft', async () => {
    const draft = { ...course, status: 'draft' as const }
    const repo = new FakeAdminContentRepository([draft])
    await archiveCourse(repo, draft)
    await restoreCourse(repo, (await repo.getCourseById('course'))!)
    expect((await repo.getCourseById('course'))?.status).toBe('draft')
  })
})
