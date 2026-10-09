import { describe, expect, it } from 'vitest'
import { recordOnePageExercise } from './save-one-page-checkpoint'
import { FakeOnePageLearningCheckpointRepository } from '../test/fakes'
import type { Lesson } from '../domain/models/lesson'

const lesson: Lesson = {
  id: 'lesson-1', unitId: 'unit-1', title: 'Words', type: 'word', order: 1,
  exercises: [
    { id: 'exercise-1', targetText: '가', romanization: 'ga', meaningTh: 'ไป', meaningEn: 'go', difficulty: 'easy', hint: null },
    { id: 'exercise-2', targetText: '나', romanization: 'na', meaningTh: 'ฉัน', meaningEn: 'I', difficulty: 'easy', hint: null },
  ],
  createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
}

describe('recordOnePageExercise', () => {
  it('keeps a local partial aggregate and completes only after the final exercise', async () => {
    const repo = new FakeOnePageLearningCheckpointRepository()
    const first = await recordOnePageExercise(repo, {
      userId: 'user-1', courseId: 'course-1', lesson,
      result: { exerciseId: 'exercise-1', targetText: '가', correctKeyCount: 2, mistakes: [] },
      now: new Date('2026-01-01T00:00:00Z'),
    })
    const second = await recordOnePageExercise(repo, {
      userId: 'user-1', courseId: 'course-1', lesson,
      result: { exerciseId: 'exercise-2', targetText: '나', correctKeyCount: 2, mistakes: [] },
      now: new Date('2026-01-01T00:00:10Z'),
    })

    expect(first.completedLesson).toBeNull()
    expect(second.completedLesson).toMatchObject({ lessonId: 'lesson-1', result: { exercisesAttempted: 2, acceptedKeystrokes: 4, rejectedKeystrokes: 0 } })
    expect(second.completedLesson?.submissionId).toBe(first.checkpoint.partialLessonResults['lesson-1'].submissionId)
    expect(second.completedLesson?.result.exercises).toEqual([
      { targetText: '가', mistakeCount: 0, typingSeconds: 0, elapsedSeconds: 0 },
      { targetText: '나', mistakeCount: 0, typingSeconds: 0, elapsedSeconds: 0 },
    ])
    expect(second.completedLesson?.result.jamoCounts).toEqual({
      ㄱ: { accepted: 1, rejected: 0 },
      ㄴ: { accepted: 1, rejected: 0 },
      ㅏ: { accepted: 2, rejected: 0 },
    })
  })
})
