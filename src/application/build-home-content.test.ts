import { describe, expect, it } from 'vitest'
import { buildHomeContent } from './build-home-content'
import { homeContentSchema } from '../domain/models/home-content'
import type { Course } from '../domain/models/course'
import type { Lesson } from '../domain/models/lesson'
import type { Unit } from '../domain/models/unit'

const at = new Date('2026-10-06T00:00:00.000Z')
const course = (id: string, overrides: Partial<Course> = {}): Course => ({
  id,
  title: id,
  description: '',
  order: 1,
  status: 'published',
  type: 'home',
  createdAt: at,
  updatedAt: at,
  ...overrides,
})
const unit = (
  id: string,
  order: number,
  overrides: Partial<Unit> = {},
): Unit => ({
  id,
  courseId: 'home',
  title: id,
  description: '',
  order,
  status: 'published',
  createdAt: at,
  updatedAt: at,
  ...overrides,
})
const lesson = (
  id: string,
  unitId: string,
  order: number,
  overrides: Partial<Lesson> = {},
): Lesson => ({
  id,
  unitId,
  title: id,
  type: 'word',
  order,
  status: 'published',
  exercises: [
    {
      id: `${id}-e1`,
      targetText: '가',
      romanization: 'ga',
      meaningTh: 'ไป',
      meaningEn: 'go',
      difficulty: 'easy',
      hint: null,
    },
  ],
  createdAt: at,
  updatedAt: at,
  ...overrides,
})

describe('buildHomeContent', () => {
  it('exports the published Home course with published units and lessons in order', () => {
    const content = buildHomeContent({
      courses: [
        course('home'),
        course('path', { type: 'learning' }),
        course('legacy', { type: undefined }),
      ],
      units: [
        unit('u2', 2),
        unit('u1', 1),
        unit('draft-unit', 3, { status: 'draft' }),
      ],
      lessons: [
        lesson('l2', 'u1', 2),
        lesson('l1', 'u1', 1),
        lesson('l3', 'u2', 1),
        lesson('archived', 'u1', 3, { status: 'archived' }),
        lesson('orphan', 'draft-unit', 1),
      ],
      exportedAt: at,
    })

    expect(homeContentSchema.parse(content)).toEqual(content)
    expect(content?.course).toEqual({
      id: 'home',
      title: 'home',
      description: '',
    })
    expect(content?.exportedAt).toBe('2026-10-06T00:00:00.000Z')
    expect(
      content?.units.map(({ id, lessons }) => [
        id,
        lessons.map(({ id: lessonId }) => lessonId),
      ]),
    ).toEqual([
      ['u1', ['l1', 'l2']],
      ['u2', ['l3']],
    ])
  })

  it('keeps only exported exercise fields', () => {
    const content = buildHomeContent({
      courses: [course('home')],
      units: [unit('u1', 1)],
      lessons: [lesson('l1', 'u1', 1)],
      exportedAt: at,
    })

    expect(content?.units[0].lessons[0]).toEqual({
      id: 'l1',
      title: 'l1',
      type: 'word',
      order: 1,
      exercises: [
        {
          id: 'l1-e1',
          targetText: '가',
          romanization: 'ga',
          meaningTh: 'ไป',
          meaningEn: 'go',
          difficulty: 'easy',
          hint: null,
        },
      ],
    })
  })

  it('drops units that have no published lessons', () => {
    const content = buildHomeContent({
      courses: [course('home')],
      units: [unit('u1', 1), unit('empty', 2)],
      lessons: [lesson('l1', 'u1', 1)],
      exportedAt: at,
    })

    expect(content?.units.map(({ id }) => id)).toEqual(['u1'])
  })

  it('returns null without a published Home course', () => {
    expect(
      buildHomeContent({
        courses: [course('home', { status: 'draft' })],
        units: [],
        lessons: [],
        exportedAt: at,
      }),
    ).toBeNull()
  })

  it('fails with more than one published Home course', () => {
    expect(() =>
      buildHomeContent({
        courses: [course('a'), course('b')],
        units: [],
        lessons: [],
        exportedAt: at,
      }),
    ).toThrow('Expected at most one published Home course, found 2.')
  })

  it('fails when the result breaks the Home content schema', () => {
    expect(() =>
      buildHomeContent({
        courses: [course('home')],
        units: [unit('u1', 1)],
        lessons: [lesson('l1', 'u1', 1, { exercises: [] })],
        exportedAt: at,
      }),
    ).toThrow()
  })

  it('fails with the lessons and exercises the keyboard cannot type', () => {
    const exercise = lesson('l1', 'u1', 1).exercises[0]
    expect(() =>
      buildHomeContent({
        courses: [course('home')],
        units: [unit('u1', 1)],
        lessons: [
          lesson('l1', 'u1', 1, {
            exercises: [
              exercise,
              { ...exercise, id: 'bad', targetText: '\u1100' },
            ],
          }),
        ],
        exportedAt: at,
      }),
    ).toThrow(
      'Home content has text the keyboard cannot type: lesson l1 exercise bad: "\u1100" U+1100',
    )
  })
})
