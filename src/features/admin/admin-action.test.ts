import { describe, expect, it } from 'vitest'
import { createAdminAction } from './admin-action'
import { FakeAdminContentRepository } from '../../test/fakes'
import type { Course } from '../../domain/models/course'
import type { Lesson } from '../../domain/models/lesson'
import type { Unit } from '../../domain/models/unit'

const now = new Date('2026-10-06')
const course: Course = {
  id: 'course',
  title: 'Course',
  description: 'Description',
  order: 0,
  status: 'draft',
  createdAt: now,
  updatedAt: now,
}
const unit: Unit = {
  id: 'unit',
  courseId: 'course',
  title: 'Unit',
  description: 'Description',
  order: 0,
  status: 'draft',
  createdAt: now,
  updatedAt: now,
}
const lesson: Lesson = {
  id: 'lesson',
  unitId: 'unit',
  title: 'Lesson',
  type: 'word',
  order: 0,
  status: 'draft',
  exercises: [],
  createdAt: now,
  updatedAt: now,
}

function seededRepo() {
  return new FakeAdminContentRepository(
    [{ ...course }],
    [{ ...unit }],
    [{ ...lesson }],
  )
}

function run(
  repo: FakeAdminContentRepository,
  fields: Record<string, string>,
  params: Record<string, string> = {},
) {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) form.set(name, value)
  return createAdminAction(repo)({
    request: new Request('https://jamozy.test/admin', {
      method: 'POST',
      body: form,
    }),
    params,
  } as never)
}

describe('createAdminAction', () => {
  describe('create intents', () => {
    it('creates a Course and returns its ID', async () => {
      const repo = seededRepo()
      const result = await run(repo, {
        intent: 'create-course',
        title: 'คอร์สใหม่',
        description: 'อธิบาย',
      })

      expect(result).toMatchObject({ message: 'feedback.courseCreated' })
      expect(await repo.getCourseById(result.createdId!)).toMatchObject({
        title: 'คอร์สใหม่',
        description: 'อธิบาย',
        status: 'draft',
      })
    })

    it('creates a Unit in the Course from the route params', async () => {
      const repo = seededRepo()
      const result = await run(
        repo,
        { intent: 'create-unit', title: 'Unit 2', description: 'About' },
        { courseId: 'course' },
      )

      expect(result).toMatchObject({ message: 'feedback.unitCreated' })
      expect((await repo.getUnitById(result.createdId!))?.courseId).toBe(
        'course',
      )
    })

    it('creates a Lesson in the Unit from the route params', async () => {
      const repo = seededRepo()
      const result = await run(
        repo,
        { intent: 'create-lesson', title: 'Lesson 2' },
        { unitId: 'unit' },
      )

      expect(result).toMatchObject({ message: 'feedback.lessonCreated' })
      expect((await repo.getLessonById(result.createdId!))?.unitId).toBe('unit')
    })

    it('creates a Lesson with the chosen type', async () => {
      const repo = seededRepo()
      const result = await run(
        repo,
        { intent: 'create-lesson', title: 'Greetings', type: 'sentence' },
        { unitId: 'unit' },
      )

      expect(await repo.getLessonById(result.createdId!)).toMatchObject({
        title: 'Greetings',
        type: 'sentence',
      })
    })

    it('creates a word Lesson when the type is unknown', async () => {
      const repo = seededRepo()
      const result = await run(
        repo,
        { intent: 'create-lesson', title: 'Greetings', type: 'essay' },
        { unitId: 'unit' },
      )

      expect((await repo.getLessonById(result.createdId!))?.type).toBe('word')
    })

    it('does not create a child without its parent route param', async () => {
      const repo = seededRepo()
      await expect(run(repo, { intent: 'create-unit' })).resolves.toEqual({
        error: 'error.missingTarget',
      })
      expect(await repo.getUnitsByCourseId('course')).toHaveLength(1)
    })
  })

  describe('order intents', () => {
    it('saves the Course order', async () => {
      const repo = new FakeAdminContentRepository([
        { ...course, id: 'a', order: 0 },
        { ...course, id: 'b', order: 1 },
      ])

      const result = await run(repo, {
        intent: 'save-course-order',
        order: JSON.stringify(['b', 'a']),
      })

      expect(result).toEqual({ message: 'feedback.courseReordered' })
      expect((await repo.getCourses()).map((item) => item.id)).toEqual([
        'b',
        'a',
      ])
    })

    it.each([
      ['malformed JSON', '[oops'],
      ['a non-array', '{"id":"a"}'],
      ['non-string IDs', '[1, 2]'],
    ])('rejects an order given as %s', async (_case, order) => {
      await expect(
        run(seededRepo(), { intent: 'save-course-order', order }),
      ).resolves.toEqual({ error: 'error.checkForm' })
    })

    it('reports a rejected order with the repository message', async () => {
      await expect(
        run(seededRepo(), {
          intent: 'save-course-order',
          order: JSON.stringify(['missing']),
        }),
      ).resolves.toEqual({
        error: 'error.actionFailed',
        errorDetail: 'Content order changed. Refresh and try again.',
      })
    })
  })

  describe('targeted intents', () => {
    it.each([
      ['no id', { intent: 'publish', kind: 'course' }],
      ['no kind', { intent: 'publish', id: 'course' }],
    ])('rejects a request with %s', async (_case, fields) => {
      await expect(run(seededRepo(), fields)).resolves.toEqual({
        error: 'error.missingTarget',
      })
    })

    it('rejects an unknown kind', async () => {
      await expect(
        run(seededRepo(), { intent: 'publish', kind: 'topic', id: 'x' }),
      ).resolves.toEqual({ error: 'error.unknownTarget' })
    })

    it.each([
      ['course', 'error.courseNotFound'],
      ['unit', 'error.unitNotFound'],
      ['lesson', 'error.lessonNotFound'],
    ])('reports a missing %s', async (kind, error) => {
      await expect(
        run(seededRepo(), { intent: 'publish', kind, id: 'missing' }),
      ).resolves.toEqual({ error })
    })

    it.each([
      ['course', 'error.unknownCourseAction'],
      ['unit', 'error.unknownUnitAction'],
      ['lesson', 'error.unknownLessonAction'],
    ])('rejects an unknown %s intent', async (kind, error) => {
      await expect(
        run(seededRepo(), { intent: 'move-up', kind, id: kind }),
      ).resolves.toEqual({ error })
    })
  })

  describe('course intents', () => {
    it('saves trimmed details and maps the Course type', async () => {
      const repo = seededRepo()

      await expect(
        run(repo, {
          intent: 'save',
          kind: 'course',
          id: 'course',
          title: '  Basics  ',
          description: ' Start here ',
          type: 'home',
        }),
      ).resolves.toEqual({ message: 'feedback.changesSaved' })
      expect(await repo.getCourseById('course')).toMatchObject({
        title: 'Basics',
        description: 'Start here',
        type: 'home',
      })

      await run(repo, {
        intent: 'save',
        kind: 'course',
        id: 'course',
        title: 'Basics',
        description: 'Start here',
        type: 'unexpected',
      })
      expect((await repo.getCourseById('course'))?.type).toBe('learning')
    })

    it('reports a blank Course title as a required field', async () => {
      const repo = seededRepo()
      await expect(
        run(repo, {
          intent: 'save',
          kind: 'course',
          id: 'course',
          title: ' ',
          description: 'Start here',
        }),
      ).resolves.toEqual({ error: 'error.fieldRequired' })
      expect((await repo.getCourseById('course'))?.title).toBe('Course')
    })

    it('publishes and archives a Course', async () => {
      const repo = seededRepo()
      await expect(
        run(repo, { intent: 'publish', kind: 'course', id: 'course' }),
      ).resolves.toEqual({ message: 'feedback.coursePublished' })
      await expect(
        run(repo, { intent: 'archive', kind: 'course', id: 'course' }),
      ).resolves.toEqual({ message: 'feedback.courseArchived' })
      expect(await repo.getCourseById('course')).toMatchObject({
        status: 'archived',
        archivedFromStatus: 'published',
      })
    })
  })

  describe('unit intents', () => {
    it('saves trimmed Unit details', async () => {
      const repo = seededRepo()
      await expect(
        run(repo, {
          intent: 'save',
          kind: 'unit',
          id: 'unit',
          title: ' Vowels ',
          description: ' Basic vowels ',
        }),
      ).resolves.toEqual({ message: 'feedback.changesSaved' })
      expect(await repo.getUnitById('unit')).toMatchObject({
        title: 'Vowels',
        description: 'Basic vowels',
      })
    })

    it('maps a blocked Unit publish to its message key', async () => {
      await expect(
        run(seededRepo(), { intent: 'publish', kind: 'unit', id: 'unit' }),
      ).resolves.toEqual({ error: 'error.publishCourseFirst' })
    })

    it('archives a Unit', async () => {
      const repo = seededRepo()
      await expect(
        run(repo, { intent: 'archive', kind: 'unit', id: 'unit' }),
      ).resolves.toEqual({ message: 'feedback.unitArchived' })
      expect((await repo.getUnitById('unit'))?.status).toBe('archived')
    })
  })

  it('reports an unexpected repository failure with its message', async () => {
    const repo = seededRepo()
    repo.saveUnit = async () => {
      throw new Error('Network unavailable.')
    }

    await expect(
      run(repo, { intent: 'archive', kind: 'unit', id: 'unit' }),
    ).resolves.toEqual({
      error: 'error.actionFailed',
      errorDetail: 'Network unavailable.',
    })
  })
})
