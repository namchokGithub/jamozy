import { describe, expect, it } from 'vitest'
import { getCourseMap, getCourses, getCourseUnits } from './get-course'
import {
  FakeCourseRepository,
  FakeLessonRepository,
  FakeProgressRepository,
} from '../test/fakes'
import type { Course } from '../domain/models/course'
import type { Unit } from '../domain/models/unit'
import type { Lesson } from '../domain/models/lesson'
import { NotFoundError } from '../domain/errors'

function makeCourse(id: string, order: number): Course {
  return { id, title: id, description: '', order, createdAt: new Date(), updatedAt: new Date() }
}

function makeUnit(id: string, courseId: string, order: number): Unit {
  return { id, courseId, title: id, description: '', order, createdAt: new Date(), updatedAt: new Date() }
}

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

describe('getCourseMap', () => {
  it('throws when the course does not exist', async () => {
    const deps = {
      courseRepo: new FakeCourseRepository(),
      lessonRepo: new FakeLessonRepository(),
      progressRepo: new FakeProgressRepository(),
    }

    await expect(getCourseMap(deps, 'user1', 'missing')).rejects.toThrow(
      'Course not found: missing',
    )
    await expect(getCourseMap(deps, 'user1', 'missing')).rejects.toBeInstanceOf(
      NotFoundError,
    )
  })

  it('returns units with their lessons, each paired with progress (null when no attempt yet)', async () => {
    const deps = {
      courseRepo: new FakeCourseRepository(
        [makeCourse('c1', 1)],
        [makeUnit('u1', 'c1', 1), makeUnit('u2', 'c1', 2)],
      ),
      lessonRepo: new FakeLessonRepository([
        makeLesson('l1', 'u1', 1),
        makeLesson('l2', 'u2', 1),
      ]),
      progressRepo: new FakeProgressRepository(),
    }

    const map = await getCourseMap(deps, 'user1', 'c1')

    expect(map.course.id).toBe('c1')
    expect(map.units.map((u) => u.unit.id)).toEqual(['u1', 'u2'])
    expect(map.units[0].lessons).toEqual([
      { lesson: expect.objectContaining({ id: 'l1' }), progress: null },
    ])
  })

  it('attaches existing progress for a lesson', async () => {
    const progressRepo = new FakeProgressRepository()
    await progressRepo.saveProgress('user1', {
      lessonId: 'l1',
      status: 'completed',
      bestAccuracy: 90,
      bestSpeedWpm: 20,
      attempts: 1,
      lastAttemptAt: new Date(),
      completedAt: new Date(),
    })
    const deps = {
      courseRepo: new FakeCourseRepository(
        [makeCourse('c1', 1)],
        [makeUnit('u1', 'c1', 1)],
      ),
      lessonRepo: new FakeLessonRepository([makeLesson('l1', 'u1', 1)]),
      progressRepo,
    }

    const map = await getCourseMap(deps, 'user1', 'c1')

    expect(map.units[0].lessons[0].progress?.status).toBe('completed')
  })
})
