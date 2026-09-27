import { describe, expect, it, vi } from 'vitest'
import { getReviewPreviews } from './get-review-previews'
import { FakeLessonRepository } from '../test/fakes'
import type { Lesson } from '../domain/models/lesson'
import type { ReviewItem } from '../domain/models/review-item'

function makeLesson(id: string, exerciseIds: string[]): Lesson {
  return {
    id,
    unitId: 'u1',
    title: id,
    type: 'word',
    order: 1,
    exercises: exerciseIds.map((exerciseId) => ({
      id: exerciseId,
      targetText: exerciseId === 'e1' ? '안녕' : '감사',
      romanization: exerciseId === 'e1' ? 'annyeong' : 'gamsa',
      meaningTh: exerciseId === 'e1' ? 'สวัสดี' : 'ขอบคุณ',
      meaningEn: exerciseId === 'e1' ? 'Hello' : 'Thank you',
      difficulty: 'easy',
      hint: null,
    })),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  }
}

function makeItem(id: string, sourceLessonId: string, sourceExerciseId: string): ReviewItem {
  return {
    id,
    sourceLessonId,
    sourceExerciseId,
    targetText: sourceExerciseId === 'e1' ? '안녕' : '감사',
    reason: 'mistake',
    mistakeCount: 1,
    lastMistakeAt: new Date('2026-01-01'),
    resolved: false,
    box: 1,
    nextReviewAt: new Date('2026-01-01'),
  }
}

describe('getReviewPreviews', () => {
  it('joins each review item to its source exercise', async () => {
    const lesson = makeLesson('l1', ['e1'])
    const item = makeItem('r1', 'l1', 'e1')

    const previews = await getReviewPreviews(new FakeLessonRepository([lesson]), [item])

    expect(previews).toEqual([{ item, exercise: lesson.exercises[0] }])
  })

  it('fetches a shared source lesson once for multiple review items', async () => {
    const lessonRepo = new FakeLessonRepository([makeLesson('l1', ['e1', 'e2'])])
    const getLessonById = vi.spyOn(lessonRepo, 'getLessonById')

    await getReviewPreviews(lessonRepo, [makeItem('r1', 'l1', 'e1'), makeItem('r2', 'l1', 'e2')])

    expect(getLessonById).toHaveBeenCalledTimes(1)
    expect(getLessonById).toHaveBeenCalledWith('l1')
  })

  it('preserves items with missing lessons or exercises as Korean-only previews', async () => {
    const presentLesson = makeLesson('l1', ['e1'])
    const missingExercise = makeItem('r1', 'l1', 'missing')
    const missingLesson = makeItem('r2', 'missing-lesson', 'e2')

    const previews = await getReviewPreviews(new FakeLessonRepository([presentLesson]), [
      missingExercise,
      missingLesson,
    ])

    expect(previews).toEqual([
      { item: missingExercise, exercise: null },
      { item: missingLesson, exercise: null },
    ])
  })

  it('preserves a Korean-only preview when a source exercise has changed its target text', async () => {
    const changedSource = makeLesson('l1', ['e1'])
    const oldItem = makeItem('r1', 'l1', 'e1')
    oldItem.targetText = '감사'

    const previews = await getReviewPreviews(new FakeLessonRepository([changedSource]), [oldItem])

    expect(previews).toEqual([{ item: oldItem, exercise: null }])
  })
})
