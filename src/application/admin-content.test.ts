import { describe, expect, it } from 'vitest'
import {
  archiveCourse,
  publishCourse,
  publishLesson,
  restoreCourse,
  saveCourse,
  saveLesson,
} from './admin-content'
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

    expect(result).toEqual({ message: 'feedback.changesSaved' })
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

  describe('untypeable target text', () => {
    const exercise = (id: string, targetText: string) => ({
      id,
      targetText,
      romanization: null,
      meaningTh: '',
      meaningEn: '',
      difficulty: 'easy' as const,
      hint: null,
    })

    it('blocks saving a Lesson whose Exercise the keyboard cannot type', async () => {
      const repo = new FakeAdminContentRepository(
        [course],
        [unit],
        [lesson([])],
      )

      const result = await saveLesson(
        repo,
        lesson([exercise('e1', '가'), exercise('e2', 'a\u1140')]),
      )

      expect(result).toEqual({
        ok: false,
        error: 'Target text has characters the keyboard cannot type.',
        detail: 'Exercise 2: "a" U+0061, "\u1140" U+1140',
      })
      expect((await repo.getLessonById('lesson'))?.exercises).toEqual([])
    })

    it('blocks publishing a Lesson whose Exercise the keyboard cannot type', async () => {
      const bad = lesson([exercise('e1', 'ab')])
      const repo = new FakeAdminContentRepository([course], [unit], [bad])

      expect(await publishLesson(repo, bad)).toEqual({
        ok: false,
        error: 'Target text has characters the keyboard cannot type.',
        detail: 'Exercise 1: "a" U+0061, "b" U+0062',
      })
      expect((await repo.getLessonById('lesson'))?.status).toBe('draft')
    })

    it('shows the untypeable characters through the admin action', async () => {
      const repo = new FakeAdminContentRepository(
        [course],
        [unit],
        [lesson([])],
      )

      const result = await createAdminAction(repo)({
        request: lessonSaveRequest({
          intent: 'save',
          kind: 'lesson',
          id: 'lesson',
          title: 'Lesson',
          type: 'character',
          exercises: JSON.stringify([exercise('e1', 'a')]),
        }),
        params: {},
      } as never)

      expect(result).toEqual({
        error: 'error.untypeableText',
        errorDetail: 'Exercise 1: "a" U+0061',
      })
    })

    it('saves conjoining jamo as the compatibility jamo the keyboard types', async () => {
      const repo = new FakeAdminContentRepository(
        [course],
        [unit],
        [lesson([])],
      )

      const result = await saveLesson(
        repo,
        lesson([
          exercise('e1', '\u1100\u1101'),
          exercise('e2', '\u1100\u1161'),
        ]),
      )

      expect(result).toEqual({ ok: true })
      expect(
        (await repo.getLessonById('lesson'))?.exercises.map(
          ({ targetText }) => targetText,
        ),
      ).toEqual(['ㄱㄲ', '가'])
    })

    it('publishes previously saved conjoining jamo as compatibility jamo', async () => {
      const legacy = lesson([exercise('e1', '\u1100')])
      const repo = new FakeAdminContentRepository([course], [unit], [legacy])

      expect(await publishLesson(repo, legacy)).toEqual({ ok: true })
      expect(
        (await repo.getLessonById('lesson'))?.exercises[0].targetText,
      ).toBe('ㄱ')
    })
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

  describe('single published Home course (DEC-043)', () => {
    const home = (id: string, status: Course['status']): Course => ({
      ...course,
      id,
      type: 'home',
      status,
    })

    it('blocks publishing a second Home course', async () => {
      const repo = new FakeAdminContentRepository([
        home('home-1', 'published'),
        home('home-2', 'draft'),
      ])

      const result = await publishCourse(
        repo,
        (await repo.getCourseById('home-2'))!,
      )

      expect(result).toEqual({
        ok: false,
        error: 'Only one published Home course is allowed.',
      })
      expect((await repo.getCourseById('home-2'))?.status).toBe('draft')
    })

    it('allows republishing the existing Home course and publishing Learning courses', async () => {
      const repo = new FakeAdminContentRepository([
        home('home-1', 'published'),
        { ...course, id: 'other', status: 'draft' },
      ])

      expect(
        await publishCourse(repo, (await repo.getCourseById('home-1'))!),
      ).toEqual({ ok: true })
      expect(
        await publishCourse(repo, (await repo.getCourseById('other'))!),
      ).toEqual({ ok: true })
    })

    it('blocks changing a published Learning course to Home when a Home course is published', async () => {
      const repo = new FakeAdminContentRepository([
        home('home-1', 'published'),
        { ...course, id: 'other' },
      ])

      const result = await saveCourse(repo, {
        ...(await repo.getCourseById('other'))!,
        type: 'home',
      })

      expect(result.ok).toBe(false)
      expect((await repo.getCourseById('other'))?.type).toBeUndefined()
    })

    it('blocks restoring an archived Home course to published while another is published', async () => {
      const repo = new FakeAdminContentRepository([
        home('home-1', 'published'),
        { ...home('home-2', 'archived'), archivedFromStatus: 'published' },
      ])

      const result = await restoreCourse(
        repo,
        (await repo.getCourseById('home-2'))!,
      )

      expect(result.ok).toBe(false)
      expect((await repo.getCourseById('home-2'))?.status).toBe('archived')
    })

    it('rejects an unknown course type', async () => {
      const repo = new FakeAdminContentRepository([course])
      const result = await saveCourse(repo, {
        ...course,
        type: 'quest' as never,
      })
      expect(result.ok).toBe(false)
    })
  })
})
