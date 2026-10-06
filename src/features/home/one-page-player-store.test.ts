import { beforeEach, describe, expect, it } from 'vitest'
import type { OnePageQueueExercise } from '../../application/get-one-page-learning-path'
import { useOnePagePlayerStore } from './one-page-player-store'

function entry(id: string, targetText: string): OnePageQueueExercise {
  return {
    course: { id: 'course-1' },
    unit: { id: 'unit-1' },
    lesson: { id: 'lesson-1' },
    exercise: { id, targetText },
  } as OnePageQueueExercise
}

const store = () => useOnePagePlayerStore.getState()

describe('useOnePagePlayerStore', () => {
  beforeEach(() => {
    store().start([entry('e1', '가'), entry('e2', '나')])
  })

  it('returns the completed entry and keeps the queue aligned with the session', () => {
    expect(store().pressKey('KeyR', false)).toBeNull()
    const completed = store().pressKey('KeyK', false)

    expect(completed?.entry.exercise.id).toBe('e1')
    expect(completed?.result).toMatchObject({ exerciseId: 'e1', correctKeyCount: 2 })
    expect(store().entries.map(({ exercise }) => exercise.id)).toEqual(['e2'])
    expect(store().session?.exercises.map(({ id }) => id)).toEqual(['e2'])
    expect(store().session?.completedResults).toEqual([])
    expect(store()).toMatchObject({ completedCount: 1, acceptedKeystrokes: 2, rejectedKeystrokes: 0 })
  })

  it('continues from the last word into an appended batch', () => {
    for (const code of ['KeyR', 'KeyK', 'KeyS', 'KeyK']) store().pressKey(code, false)
    expect(store().session?.status).toBe('completed')

    store().append([entry('e3', '다')])

    expect(store().session?.status).toBe('typing')
    expect(store().session?.currentSession.targetText).toBe('다')
    expect(store().entries.map(({ exercise }) => exercise.id)).toEqual(['e3'])
    expect(store().completedCount).toBe(2)
  })

  it('marks the queue exhausted when a refill is empty', () => {
    store().append([])
    expect(store().exhausted).toBe(true)
    expect(store().entries).toHaveLength(2)
  })
})
