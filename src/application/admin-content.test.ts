import { describe, expect, it } from 'vitest'
import {
  archiveCourse,
  createDraftCourse,
  createDraftLesson,
  createDraftUnit,
  publishCourse,
  publishLesson,
  publishLessonWithParents,
  publishUnitWithParents,
  restoreCourse,
  restoreLesson,
  restoreUnit,
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

  it('saves only known Exercise fields from the editor form', async () => {
    const repo = new FakeAdminContentRepository([course], [unit], [lesson([])])
    const exercise = {
      id: 'exercise',
      targetText: '가',
      romanization: null,
      meaningTh: '',
      meaningEn: '',
      difficulty: 'easy',
      hint: null,
    }

    const result = await createAdminAction(repo)({
      request: lessonSaveRequest({
        intent: 'save',
        kind: 'lesson',
        id: 'lesson',
        title: 'Lesson',
        type: 'word',
        exercises: JSON.stringify([{ ...exercise, unexpected: 'field' }]),
      }),
      params: {},
    } as never)

    expect(result).toEqual({ message: 'feedback.changesSaved' })
    expect((await repo.getLessonById('lesson'))?.exercises).toEqual([exercise])
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
      error: 'exerciseRequired',
    })
    expect((await repo.getLessonById('lesson'))?.status).toBe('draft')
  })

  it('blocks saving a published Lesson without an Exercise', async () => {
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
      [lesson([existingExercise], 'published')],
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

    expect(result).toEqual({ error: 'error.publishedExerciseRequired' })
    expect((await repo.getLessonById('lesson'))?.exercises).toEqual([
      existingExercise,
    ])
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
        error: 'untypeableText',
        detail: 'Exercise 2: "a" U+0061, "\u1140" U+1140',
      })
      expect((await repo.getLessonById('lesson'))?.exercises).toEqual([])
    })

    it('blocks publishing a Lesson whose Exercise the keyboard cannot type', async () => {
      const bad = lesson([exercise('e1', 'ab')])
      const repo = new FakeAdminContentRepository([course], [unit], [bad])

      expect(await publishLesson(repo, bad)).toEqual({
        ok: false,
        error: 'untypeableText',
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

    it('trims surrounding whitespace from pasted target text but keeps inner spaces', async () => {
      const repo = new FakeAdminContentRepository(
        [course],
        [unit],
        [lesson([])],
      )

      const result = await saveLesson(
        repo,
        lesson([
          exercise('e1', '\t가려지다 \n'),
          exercise('e2', '  안녕 하세요  '),
        ]),
      )

      expect(result).toEqual({ ok: true })
      expect(
        (await repo.getLessonById('lesson'))?.exercises.map(
          ({ targetText }) => targetText,
        ),
      ).toEqual(['가려지다', '안녕 하세요'])
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
    ).resolves.toEqual({ ok: false, error: 'publishCourseFirst' })
  })

  it('restores an archived draft Course as draft', async () => {
    const draft = { ...course, status: 'draft' as const }
    const repo = new FakeAdminContentRepository([draft])
    await archiveCourse(repo, draft)
    await restoreCourse(repo, (await repo.getCourseById('course'))!)
    expect((await repo.getCourseById('course'))?.status).toBe('draft')
  })

  describe('publishing with unpublished parents', () => {
    const exercise = {
      id: 'exercise',
      targetText: '가',
      romanization: null,
      meaningTh: '',
      meaningEn: '',
      difficulty: 'easy' as const,
      hint: null,
    }
    const draftCourse = { ...course, status: 'draft' as const }
    const draftUnit = { ...unit, status: 'draft' as const }
    const archivedCourse = {
      ...course,
      status: 'archived' as const,
      archivedFromStatus: 'draft' as const,
    }

    it('publishes the Course, Unit, and Lesson top-down', async () => {
      const repo = new FakeAdminContentRepository(
        [draftCourse],
        [draftUnit],
        [lesson([exercise])],
      )

      const result = await createAdminAction(repo)({
        request: lessonSaveRequest({
          intent: 'publish-with-parents',
          kind: 'lesson',
          id: 'lesson',
        }),
        params: {},
      } as never)

      expect(result).toEqual({ message: 'feedback.lessonPublished' })
      expect((await repo.getCourseById('course'))?.status).toBe('published')
      expect((await repo.getUnitById('unit'))?.status).toBe('published')
      expect((await repo.getLessonById('lesson'))?.status).toBe('published')
    })

    it('publishes an archived parent Course and clears its archive record', async () => {
      const repo = new FakeAdminContentRepository([archivedCourse], [draftUnit])

      await expect(publishUnitWithParents(repo, draftUnit)).resolves.toEqual({
        ok: true,
      })

      const published = await repo.getCourseById('course')
      expect(published?.status).toBe('published')
      expect(published?.archivedFromStatus).toBeUndefined()
      expect((await repo.getUnitById('unit'))?.status).toBe('published')
    })

    it('publishes no parent when the Lesson cannot be published', async () => {
      const repo = new FakeAdminContentRepository(
        [draftCourse],
        [draftUnit],
        [lesson([])],
      )

      await expect(publishLessonWithParents(repo, lesson([]))).resolves.toEqual(
        {
          ok: false,
          error: 'exerciseRequired',
        },
      )
      expect((await repo.getCourseById('course'))?.status).toBe('draft')
      expect((await repo.getUnitById('unit'))?.status).toBe('draft')
    })

    it('publishes nothing when the parent Home course conflicts', async () => {
      const repo = new FakeAdminContentRepository(
        [
          { ...course, id: 'home', type: 'home' },
          { ...draftCourse, type: 'home' },
        ],
        [draftUnit],
      )

      await expect(publishUnitWithParents(repo, draftUnit)).resolves.toEqual({
        ok: false,
        error: 'oneHomeCourse',
      })
      expect((await repo.getCourseById('course'))?.status).toBe('draft')
      expect((await repo.getUnitById('unit'))?.status).toBe('draft')
    })
  })

  describe('restoring an archived Published Unit or Lesson', () => {
    const exercise = {
      id: 'exercise',
      targetText: '가',
      romanization: null,
      meaningTh: '',
      meaningEn: '',
      difficulty: 'easy' as const,
      hint: null,
    }
    const archived = <T extends Unit | Lesson>(item: T): T => ({
      ...item,
      status: 'archived',
      archivedFromStatus: 'published',
    })
    const draftCourse = { ...course, status: 'draft' as const }
    const draftUnit = { ...unit, status: 'draft' as const }

    it('restores a Unit as Published below a Published Course', async () => {
      const repo = new FakeAdminContentRepository([course], [archived(unit)])
      await expect(
        restoreUnit(repo, (await repo.getUnitById('unit'))!),
      ).resolves.toEqual({ ok: true, status: 'published' })
      expect((await repo.getUnitById('unit'))?.status).toBe('published')
    })

    it('restores a Unit as Draft below a non-Published Course', async () => {
      const repo = new FakeAdminContentRepository(
        [draftCourse],
        [archived(unit)],
      )

      const result = await createAdminAction(repo)({
        request: lessonSaveRequest({
          intent: 'restore',
          kind: 'unit',
          id: 'unit',
        }),
        params: {},
      } as never)

      expect(result).toEqual({ message: 'feedback.unitRestoredAsDraft' })
      const restored = await repo.getUnitById('unit')
      expect(restored?.status).toBe('draft')
      expect(restored?.archivedFromStatus).toBeUndefined()
    })

    it('restores a Lesson as Draft below a non-Published Unit', async () => {
      const repo = new FakeAdminContentRepository(
        [course],
        [draftUnit],
        [archived(lesson([]))],
      )

      const result = await createAdminAction(repo)({
        request: lessonSaveRequest({
          intent: 'restore',
          kind: 'lesson',
          id: 'lesson',
        }),
        params: {},
      } as never)

      expect(result).toEqual({ message: 'feedback.lessonRestoredAsDraft' })
      expect((await repo.getLessonById('lesson'))?.status).toBe('draft')
    })

    it('restores a valid Lesson as Published below Published parents', async () => {
      const repo = new FakeAdminContentRepository(
        [course],
        [unit],
        [archived(lesson([exercise]))],
      )
      await expect(
        restoreLesson(repo, (await repo.getLessonById('lesson'))!),
      ).resolves.toEqual({ ok: true, status: 'published' })
      expect((await repo.getLessonById('lesson'))?.status).toBe('published')
    })

    it('blocks restoring a Lesson as Published without an Exercise', async () => {
      const repo = new FakeAdminContentRepository(
        [course],
        [unit],
        [archived(lesson([]))],
      )
      await expect(
        restoreLesson(repo, (await repo.getLessonById('lesson'))!),
      ).resolves.toEqual({
        ok: false,
        error: 'exerciseRequired',
      })
      expect((await repo.getLessonById('lesson'))?.status).toBe('archived')
    })
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
        error: 'oneHomeCourse',
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
      expect(result).toEqual({ ok: false, error: 'checkForm' })
    })
  })
})

describe('admin content order', () => {
  const units = (...ids: string[]): Unit[] =>
    ids.map((id, order) => ({ ...unit, id, order }))
  const lessons = (...ids: string[]): Lesson[] =>
    ids.map((id, order) => ({ ...lesson([]), id, order }))
  const orderRequest = (intent: string, order: string[]) =>
    lessonSaveRequest({ intent, order: JSON.stringify(order) })
  const orderOf = (items: { id: string }[]) => items.map((item) => item.id)

  it('saves a whole Unit order for its Course', async () => {
    const repo = new FakeAdminContentRepository(
      [course],
      [...units('a', 'b', 'c'), { ...unit, id: 'other', courseId: 'x' }],
    )

    const result = await createAdminAction(repo)({
      request: orderRequest('save-unit-order', ['c', 'a', 'b']),
      params: { courseId: 'course' },
    } as never)

    expect(result).toEqual({ message: 'feedback.unitReordered' })
    expect(orderOf(await repo.getUnitsByCourseId('course'))).toEqual([
      'c',
      'a',
      'b',
    ])
  })

  it('saves a whole Lesson order for its Unit', async () => {
    const repo = new FakeAdminContentRepository(
      [course],
      [unit],
      lessons('a', 'b', 'c'),
    )

    const result = await createAdminAction(repo)({
      request: orderRequest('save-lesson-order', ['b', 'c', 'a']),
      params: { unitId: 'unit' },
    } as never)

    expect(result).toEqual({ message: 'feedback.lessonReordered' })
    expect(orderOf(await repo.getLessonsByUnitId('unit'))).toEqual([
      'b',
      'c',
      'a',
    ])
  })

  it.each([
    ['is missing a sibling', ['b', 'a']],
    ['repeats a sibling', ['a', 'a', 'b']],
    ['names an item from another parent', ['a', 'b', 'other']],
  ])(
    'rejects a Unit order that %s and keeps the saved order',
    async (_case, order) => {
      const repo = new FakeAdminContentRepository(
        [course],
        [...units('a', 'b', 'c'), { ...unit, id: 'other', courseId: 'x' }],
      )

      const result = await createAdminAction(repo)({
        request: orderRequest('save-unit-order', order),
        params: { courseId: 'course' },
      } as never)

      expect(result).toEqual({
        error: 'error.actionFailed',
        errorDetail: 'Content order changed. Refresh and try again.',
      })
      expect(orderOf(await repo.getUnitsByCourseId('course'))).toEqual([
        'a',
        'b',
        'c',
      ])
    },
  )
})

describe('creating admin content', () => {
  it('creates a Draft Course, Unit, and Lesson with placeholder text', async () => {
    const repo = new FakeAdminContentRepository()

    const createdCourse = await createDraftCourse(repo)
    const createdUnit = await createDraftUnit(repo, createdCourse.id)
    const createdLesson = await createDraftLesson(repo, createdUnit.id)

    expect(createdCourse).toMatchObject({
      title: 'Untitled Course',
      description: 'Describe this learning path.',
      status: 'draft',
    })
    expect(createdUnit).toMatchObject({
      courseId: createdCourse.id,
      title: 'Untitled Unit',
      description: 'Describe this Unit.',
      status: 'draft',
    })
    expect(createdLesson).toMatchObject({
      unitId: createdUnit.id,
      title: 'Untitled Lesson',
      type: 'word',
      status: 'draft',
    })
  })
})
