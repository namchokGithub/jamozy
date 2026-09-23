import { describe, expect, it } from 'vitest'
import { getLesson, getLessonsByUnit } from './get-lesson'
import { FakeLessonRepository } from '../test/fakes'
import type { Lesson } from '../domain/models/lesson'

function makeLesson(id: string, unitId: string, order: number): Lesson {
  return {
    id,
    unitId,
    title: id,
    type: 'word',
    order,
    exercises: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('getLessonsByUnit', () => {
  it('returns only lessons for the given unit, ordered', async () => {
    const repo = new FakeLessonRepository([
      makeLesson('l2', 'u1', 2),
      makeLesson('l1', 'u1', 1),
      makeLesson('l3', 'other', 1),
    ])
    const lessons = await getLessonsByUnit(repo, 'u1')
    expect(lessons.map((l) => l.id)).toEqual(['l1', 'l2'])
  })
})

describe('getLesson', () => {
  it('returns null when not found', async () => {
    const repo = new FakeLessonRepository([])
    expect(await getLesson(repo, 'missing')).toBeNull()
  })

  it('returns the lesson when found', async () => {
    const repo = new FakeLessonRepository([makeLesson('l1', 'u1', 1)])
    expect((await getLesson(repo, 'l1'))?.id).toBe('l1')
  })
})
