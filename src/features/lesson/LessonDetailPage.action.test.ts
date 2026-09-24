import { describe, expect, it, vi } from 'vitest'
import { createCompleteLessonSessionAction } from './LessonDetailPage.action'
import {
  FakeCourseRepository,
  FakeLessonRepository,
  FakeProgressRepository,
  FakeUserProfileRepository,
  FakeReviewRepository,
} from '../../test/fakes'
import type { Lesson } from '../../domain/models/lesson'
import type { Unit } from '../../domain/models/unit'

function makeUnit(id: string): Unit {
  return { id, courseId: 'c1', title: id, description: '', order: 1, createdAt: new Date(), updatedAt: new Date() }
}

function makeLesson(id: string, unitId: string): Lesson {
  return { id, unitId, title: id, type: 'word', order: 1, exercises: [], createdAt: new Date(), updatedAt: new Date() }
}

function makeDeps() {
  return {
    courseRepo: new FakeCourseRepository([], [makeUnit('u1')]),
    lessonRepo: new FakeLessonRepository([makeLesson('l1', 'u1')]),
    progressRepo: new FakeProgressRepository(),
    userProfileRepo: new FakeUserProfileRepository(),
    reviewRepo: new FakeReviewRepository(),
    ensureUser: vi.fn().mockResolvedValue({ uid: 'user1' }),
  }
}

describe('createCompleteLessonSessionAction', () => {
  it('signs in, parses the request body, and completes the lesson session', async () => {
    const deps = makeDeps()
    const action = createCompleteLessonSessionAction(deps)
    const request = new Request('http://localhost/lessons/l1', {
      method: 'POST',
      body: JSON.stringify({ accuracy: 100, speedWpm: 20, durationSeconds: 30, mistakes: [] }),
    })

    const outcome = await action({ params: { lessonId: 'l1' }, request } as never)

    expect(deps.ensureUser).toHaveBeenCalledOnce()
    expect(outcome.progress.status).toBe('completed')
  })

  it('throws when lessonId is missing from params', async () => {
    const deps = makeDeps()
    const action = createCompleteLessonSessionAction(deps)
    const request = new Request('http://localhost/lessons/x', { method: 'POST', body: '{}' })

    await expect(action({ params: {}, request } as never)).rejects.toThrow('Lesson id is required')
  })

  it('rejects a malformed request body', async () => {
    const deps = makeDeps()
    const action = createCompleteLessonSessionAction(deps)
    const request = new Request('http://localhost/lessons/l1', {
      method: 'POST',
      body: JSON.stringify({ accuracy: 'not-a-number' }),
    })

    await expect(action({ params: { lessonId: 'l1' }, request } as never)).rejects.toThrow()
  })
})
