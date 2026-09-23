import { describe, expect, it, vi } from 'vitest'
import { createCourseMapLoader } from './CourseMapPage.loader'
import {
  FakeCourseRepository,
  FakeLessonRepository,
  FakeProgressRepository,
} from '../../test/fakes'
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

describe('createCourseMapLoader', () => {
  it('signs in as the current user before reading the course map', async () => {
    const ensureUser = vi.fn().mockResolvedValue({ uid: 'user1' })
    const loader = createCourseMapLoader({
      courseRepo: new FakeCourseRepository([makeCourse('c1')]),
      lessonRepo: new FakeLessonRepository(),
      progressRepo: new FakeProgressRepository(),
      ensureUser,
    })

    const data = await loader({ params: { courseId: 'c1' } } as never)

    expect(ensureUser).toHaveBeenCalledOnce()
    expect(data.courseMap.course.id).toBe('c1')
  })

  it('throws when courseId is missing from params', async () => {
    const ensureUser = vi.fn().mockResolvedValue({ uid: 'user1' })
    const loader = createCourseMapLoader({
      courseRepo: new FakeCourseRepository(),
      lessonRepo: new FakeLessonRepository(),
      progressRepo: new FakeProgressRepository(),
      ensureUser,
    })

    await expect(loader({ params: {} } as never)).rejects.toThrow(
      'Course id is required',
    )
  })
})
