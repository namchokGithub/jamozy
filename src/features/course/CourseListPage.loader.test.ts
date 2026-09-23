import { describe, expect, it, vi } from 'vitest'
import { createCourseListLoader } from './CourseListPage.loader'
import { FakeCourseRepository } from '../../test/fakes'
import type { Course } from '../../domain/models/course'

function makeCourse(id: string): Course {
  return {
    id,
    title: id,
    description: '',
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('createCourseListLoader', () => {
  it('signs in before reading courses, and returns them', async () => {
    const ensureUser = vi.fn().mockResolvedValue({ uid: 'user1' })
    const loader = createCourseListLoader({
      courseRepo: new FakeCourseRepository([makeCourse('c1')]),
      ensureUser,
    })

    const data = await loader()

    expect(ensureUser).toHaveBeenCalledOnce()
    expect(data.courses.map((c) => c.id)).toEqual(['c1'])
  })
})
