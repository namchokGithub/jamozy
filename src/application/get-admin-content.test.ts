import { describe, expect, it } from 'vitest'
import {
  getAdminCourseEditor,
  getAdminDashboard,
  getAdminLessonEditor,
  getAdminUnitEditor,
} from './get-admin-content'
import { NotFoundError } from '../domain/errors'
import { FakeAdminContentRepository } from '../test/fakes'
import type { Course } from '../domain/models/course'
import type { Lesson } from '../domain/models/lesson'
import type { Unit } from '../domain/models/unit'

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

describe('admin content reads', () => {
  const repo = () => new FakeAdminContentRepository([course], [unit], [lesson])

  it('lists every Course for the dashboard', async () => {
    await expect(getAdminDashboard(repo())).resolves.toEqual({
      courses: [course],
    })
  })

  it('loads each editor with its parents and children', async () => {
    await expect(getAdminCourseEditor(repo(), 'course')).resolves.toEqual({
      course,
      units: [unit],
    })
    await expect(getAdminUnitEditor(repo(), 'unit')).resolves.toEqual({
      unit,
      course,
      lessons: [lesson],
    })
    await expect(getAdminLessonEditor(repo(), 'lesson')).resolves.toEqual({
      lesson,
      unit,
      course,
    })
  })

  it('throws NotFoundError for an unknown editor target', async () => {
    await expect(getAdminCourseEditor(repo(), 'missing')).rejects.toThrow(
      NotFoundError,
    )
    await expect(getAdminUnitEditor(repo(), 'missing')).rejects.toThrow(
      NotFoundError,
    )
    await expect(getAdminLessonEditor(repo(), 'missing')).rejects.toThrow(
      NotFoundError,
    )
  })

  it('loads a Lesson whose Unit is missing without parents', async () => {
    const orphan = new FakeAdminContentRepository([course], [], [lesson])
    await expect(getAdminLessonEditor(orphan, 'lesson')).resolves.toEqual({
      lesson,
      unit: null,
      course: null,
    })
  })
})
