import { describe, expect, it, vi } from 'vitest'
import { createLessonDetailLoader } from './LessonDetailPage.loader'
import { FakeLessonRepository } from '../../test/fakes'
import { NotFoundError } from '../../domain/errors'
import type { Lesson } from '../../domain/models/lesson'

function makeLesson(id: string): Lesson {
  return {
    id,
    unitId: 'u1',
    title: id,
    type: 'word',
    order: 1,
    exercises: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('createLessonDetailLoader', () => {
  it('signs in before reading the lesson, and returns it', async () => {
    const ensureUser = vi.fn().mockResolvedValue({ uid: 'user1' })
    const loader = createLessonDetailLoader({
      lessonRepo: new FakeLessonRepository([makeLesson('l1')]),
      ensureUser,
    })

    const data = await loader({ params: { lessonId: 'l1' } } as never)

    expect(ensureUser).toHaveBeenCalledOnce()
    expect(data.lesson.id).toBe('l1')
  })

  it('throws NotFoundError when the lesson does not exist', async () => {
    const ensureUser = vi.fn().mockResolvedValue({ uid: 'user1' })
    const loader = createLessonDetailLoader({
      lessonRepo: new FakeLessonRepository(),
      ensureUser,
    })

    await expect(
      loader({ params: { lessonId: 'missing' } } as never),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws when lessonId is missing from params', async () => {
    const ensureUser = vi.fn().mockResolvedValue({ uid: 'user1' })
    const loader = createLessonDetailLoader({
      lessonRepo: new FakeLessonRepository(),
      ensureUser,
    })

    await expect(loader({ params: {} } as never)).rejects.toThrow(
      'Lesson id is required',
    )
  })
})
