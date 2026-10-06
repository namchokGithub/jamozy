import { describe, expect, it } from 'vitest'
import { getOrderedLearningPath } from './learning-path-order'
import type { CourseRepository } from '../domain/repositories/course-repository'
import type { LessonRepository } from '../domain/repositories/lesson-repository'
import type { Course } from '../domain/models/course'
import type { Lesson } from '../domain/models/lesson'
import type { Unit } from '../domain/models/unit'

const at = new Date('2026-01-01')
const course = (id: string, order: number): Course =>
  ({ id, title: id, description: '', order, createdAt: at, updatedAt: at })
const unit = (id: string, courseId: string, order: number): Unit =>
  ({ id, courseId, title: id, description: '', order, createdAt: at, updatedAt: at })
const lesson = (id: string, unitId: string, order: number): Lesson =>
  ({ id, unitId, title: id, type: 'word', order, exercises: [], createdAt: at, updatedAt: at })

const courses = [course('c2', 2), course('c1', 1)]
const units = [unit('c1-u2', 'c1', 2), unit('c1-u1', 'c1', 1), unit('c2-u1', 'c2', 1)]
const lessons = [lesson('c1-u1-l2', 'c1-u1', 2), lesson('c1-u1-l1', 'c1-u1', 1), lesson('c1-u2-l1', 'c1-u2', 1), lesson('c2-u1-l1', 'c2-u1', 1)]

// Repositories that answer in reverse request order, so the result cannot
// depend on which concurrent query resolves first.
function reverseResolving() {
  const pending: Array<() => void> = []
  let inFlight = 0
  const delayed = <T>(value: T) => new Promise<T>((resolve) => {
    inFlight += 1
    pending.push(() => resolve(value))
    queueMicrotask(() => {
      inFlight -= 1
      if (inFlight === 0) pending.splice(0).reverse().forEach((release) => release())
    })
  })
  const courseRepo = {
    getCourses: async () => courses,
    getUnitsByCourseId: (courseId: string) => delayed(units.filter((u) => u.courseId === courseId)),
  } as unknown as CourseRepository
  const lessonRepo = {
    getLessonsByUnitId: (unitId: string) => delayed(lessons.filter((l) => l.unitId === unitId)),
  } as unknown as LessonRepository
  return { courseRepo, lessonRepo }
}

describe('getOrderedLearningPath', () => {
  it('orders lessons by course, unit, and lesson order regardless of query completion order', async () => {
    const { courseRepo, lessonRepo } = reverseResolving()

    const ordered = await getOrderedLearningPath(courseRepo, lessonRepo)

    expect(ordered.map(({ lesson }) => lesson.id)).toEqual(['c1-u1-l1', 'c1-u1-l2', 'c1-u2-l1', 'c2-u1-l1'])
    expect(ordered.map(({ course, unit }) => `${course.id}/${unit.id}`)).toEqual(['c1/c1-u1', 'c1/c1-u1', 'c1/c1-u2', 'c2/c2-u1'])
  })

  it('requests every course and unit before awaiting any of them', async () => {
    const calls: string[] = []
    const never = new Promise<never>(() => {})
    const courseRepo = {
      getCourses: async () => courses,
      getUnitsByCourseId: (courseId: string) => {
        calls.push(courseId)
        return never
      },
    } as unknown as CourseRepository

    void getOrderedLearningPath(courseRepo, {} as LessonRepository)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(calls.sort()).toEqual(['c1', 'c2'])
  })

  it('leaves the Home course out of the global order (DEC-043)', async () => {
    const courseRepo = {
      getCourses: async () => [course('c1', 1), { ...course('home', 0), type: 'home' as const }],
      getUnitsByCourseId: async (courseId: string) => units.filter((u) => u.courseId === courseId)
        .concat(courseId === 'home' ? [unit('home-u1', 'home', 1)] : []),
    } as unknown as CourseRepository
    const lessonRepo = {
      getLessonsByUnitId: async (unitId: string) => lessons.filter((l) => l.unitId === unitId)
        .concat(unitId === 'home-u1' ? [lesson('home-l1', 'home-u1', 1)] : []),
    } as unknown as LessonRepository

    const ordered = await getOrderedLearningPath(courseRepo, lessonRepo)

    expect(ordered.map(({ course }) => course.id)).not.toContain('home')
  })
})

