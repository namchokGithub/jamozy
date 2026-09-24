import { describe, expect, it, vi } from 'vitest'
import { createLessonDetailLoader } from './LessonDetailPage.loader'
import { FakeLessonRepository, FakeUserProfileRepository } from '../../test/fakes'
import { NotFoundError } from '../../domain/errors'
import { defaultUserProfile } from '../../domain/models/user-profile'
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
  it('signs in before reading the lesson, and returns it alongside the default settings for a new user', async () => {
    const ensureUser = vi.fn().mockResolvedValue({ uid: 'user1' })
    const loader = createLessonDetailLoader({
      lessonRepo: new FakeLessonRepository([makeLesson('l1')]),
      userProfileRepo: new FakeUserProfileRepository(),
      ensureUser,
    })

    const data = await loader({ params: { lessonId: 'l1' } } as never)

    expect(ensureUser).toHaveBeenCalledOnce()
    expect(data.lesson.id).toBe('l1')
    expect(data.settings.meaningLanguage).toBe('both')
    expect(data.settings.romanizationEnabled).toBe(true)
  })

  it("returns an existing user's saved settings", async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const profile = defaultUserProfile('user1', new Date('2025-01-01'))
    await userProfileRepo.saveUserProfile('user1', {
      ...profile,
      settings: { ...profile.settings, meaningLanguage: 'th', romanizationEnabled: false },
    })
    const loader = createLessonDetailLoader({
      lessonRepo: new FakeLessonRepository([makeLesson('l1')]),
      userProfileRepo,
      ensureUser: vi.fn().mockResolvedValue({ uid: 'user1' }),
    })

    const data = await loader({ params: { lessonId: 'l1' } } as never)

    expect(data.settings.meaningLanguage).toBe('th')
    expect(data.settings.romanizationEnabled).toBe(false)
  })

  it('throws NotFoundError when the lesson does not exist', async () => {
    const ensureUser = vi.fn().mockResolvedValue({ uid: 'user1' })
    const loader = createLessonDetailLoader({
      lessonRepo: new FakeLessonRepository(),
      userProfileRepo: new FakeUserProfileRepository(),
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
      userProfileRepo: new FakeUserProfileRepository(),
      ensureUser,
    })

    await expect(loader({ params: {} } as never)).rejects.toThrow(
      'Lesson id is required',
    )
  })
})
