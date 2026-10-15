import { describe, expect, it } from 'vitest'
import {
  clearLessonResume,
  getLessonResume,
  saveLessonResume,
} from './lesson-resume'

function createStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }
}

describe('lesson resume', () => {
  it('resumes only a reload of the same lesson before its five-minute expiry', () => {
    const storage = createStorage()
    saveLessonResume(storage, 'lesson-1', 1_000)

    expect(getLessonResume(storage, 'lesson-1', 'reload', 300_999)).toEqual({
      lessonId: 'lesson-1',
      expiresAtMs: 301_000,
    })
    expect(getLessonResume(storage, 'lesson-2', 'reload', 2_000)).toBeNull()
    expect(storage.length).toBe(0)

    saveLessonResume(storage, 'lesson-1', 1_000)
    expect(getLessonResume(storage, 'lesson-1', 'navigate', 2_000)).toBeNull()
  })

  it('clears expired and explicitly cleared resumes', () => {
    const storage = createStorage()
    saveLessonResume(storage, 'lesson-1', 1_000)

    expect(getLessonResume(storage, 'lesson-1', 'reload', 301_000)).toBeNull()

    saveLessonResume(storage, 'lesson-1', 1_000)
    clearLessonResume(storage)
    expect(getLessonResume(storage, 'lesson-1', 'reload', 2_000)).toBeNull()
  })
})
