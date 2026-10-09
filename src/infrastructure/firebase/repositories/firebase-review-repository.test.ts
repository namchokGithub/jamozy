import { describe, expect, it } from 'vitest'
import { toReviewItem } from './firebase-review-repository'

const stored = {
  sourceLessonId: 'lesson-1',
  sourceExerciseId: 'exercise-1',
  targetText: '가',
  reason: 'mistake',
  mistakeCount: 1,
  lastMistakeAt: { toDate: () => new Date('2026-10-09') },
  resolved: false,
  box: 1,
  nextReviewAt: { toDate: () => new Date('2026-10-10') },
}

describe('toReviewItem', () => {
  // Items are written back as-is on submit, and Firestore rejects undefined
  // field values, so an item stored before DEC-049 must not gain the key.
  it('leaves out the source lesson type when the document has none', () => {
    expect(toReviewItem('exercise-1', stored)).not.toHaveProperty(
      'sourceLessonType',
    )
  })

  it('reads a stored source lesson type', () => {
    expect(
      toReviewItem('exercise-1', { ...stored, sourceLessonType: 'word' }),
    ).toMatchObject({ sourceLessonType: 'word' })
  })
})
