import { describe, expect, it } from 'vitest'
import { getCourses, getCourseUnits } from './get-course'
import { FakeCourseRepository } from '../test/fakes'
import type { Course } from '../domain/models/course'
import type { Unit } from '../domain/models/unit'

function makeCourse(id: string, order: number): Course {
  return { id, title: id, description: '', order, createdAt: new Date(), updatedAt: new Date() }
}

function makeUnit(id: string, courseId: string, order: number): Unit {
  return { id, courseId, title: id, description: '', order, createdAt: new Date(), updatedAt: new Date() }
}

describe('getCourses', () => {
  it('returns courses ordered', async () => {
    const repo = new FakeCourseRepository([makeCourse('b', 2), makeCourse('a', 1)])
    const courses = await getCourses(repo)
    expect(courses.map((c) => c.id)).toEqual(['a', 'b'])
  })
})

describe('getCourseUnits', () => {
  it('returns only units for the given course, ordered', async () => {
    const repo = new FakeCourseRepository(
      [],
      [makeUnit('u2', 'c1', 2), makeUnit('u1', 'c1', 1), makeUnit('u3', 'other', 1)],
    )
    const units = await getCourseUnits(repo, 'c1')
    expect(units.map((u) => u.id)).toEqual(['u1', 'u2'])
  })
})
