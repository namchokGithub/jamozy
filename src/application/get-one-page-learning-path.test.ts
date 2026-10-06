import { describe, expect, it } from 'vitest'
import { getOnePageLearningPath } from './get-one-page-learning-path'
import {
  FakeCourseRepository,
  FakeLessonRepository,
  FakeOnePageLearningCheckpointRepository,
  FakeProgressRepository,
} from '../test/fakes'
import type { Course } from '../domain/models/course'
import type { Lesson } from '../domain/models/lesson'
import type { Unit } from '../domain/models/unit'

const at = new Date('2026-01-01')

function course(id: string, order: number): Course {
  return { id, title: id, description: '', order, createdAt: at, updatedAt: at }
}

function unit(id: string, courseId: string): Unit {
  return { id, courseId, title: id, description: '', order: 1, createdAt: at, updatedAt: at }
}

function lesson(id: string, unitId: string, order: number, exerciseCount: number): Lesson {
  return {
    id, unitId, title: id, type: 'word', order,
    exercises: Array.from({ length: exerciseCount }, (_, index) => ({
      id: `${id}-e${index + 1}`, targetText: '가', romanization: 'ga',
      meaningTh: '', meaningEn: '', difficulty: 'easy' as const, hint: null,
    })),
    createdAt: at, updatedAt: at,
  }
}

function setup(lessons: Lesson[]) {
  const progressRepo = new FakeProgressRepository()
  const checkpointRepo = new FakeOnePageLearningCheckpointRepository()
  const deps = {
    courseRepo: new FakeCourseRepository(
      [course('course-1', 1), course('course-2', 2)],
      [unit('unit-1', 'course-1'), unit('unit-2', 'course-2')],
    ),
    lessonRepo: new FakeLessonRepository(lessons),
    progressRepo,
    checkpointRepo,
  }
  const completeLesson = (lessonId: string) => progressRepo.saveProgress('user-1', {
    lessonId, status: 'completed', bestAccuracy: 100, bestSpeedWpm: 10,
    attempts: 1, lastAttemptAt: at, completedAt: at,
  })
  return { deps, checkpointRepo, completeLesson }
}

const queueIds = (path: { queue: Array<{ exercise: { id: string } }> }) =>
  path.queue.map(({ exercise }) => exercise.id)

describe('getOnePageLearningPath', () => {
  it('starts a ten-exercise queue at the first incomplete exercise of one course', async () => {
    const { deps } = setup([lesson('l1', 'unit-1', 1, 6), lesson('l2', 'unit-1', 2, 6), lesson('l3', 'unit-2', 1, 3)])

    const path = await getOnePageLearningPath(deps, 'user-1')

    expect(path.selectedCourseId).toBe('course-1')
    expect(queueIds(path)).toEqual([
      'l1-e1', 'l1-e2', 'l1-e3', 'l1-e4', 'l1-e5', 'l1-e6', 'l2-e1', 'l2-e2', 'l2-e3', 'l2-e4',
    ])
  })

  it('refills with the exercises after the cursor, independent of saved checkpoints', async () => {
    const { deps } = setup([lesson('l1', 'unit-1', 1, 6), lesson('l2', 'unit-1', 2, 6)])

    const path = await getOnePageLearningPath(deps, 'user-1', 'course-1', { lessonId: 'l2', exerciseId: 'l2-e4' })

    expect(queueIds(path)).toEqual(['l2-e5', 'l2-e6'])
  })

  it('still skips exercises already checkpointed after the cursor', async () => {
    const { deps, checkpointRepo } = setup([lesson('l1', 'unit-1', 1, 4)])
    await checkpointRepo.saveCheckpoint({
      userId: 'user-1', courseId: 'course-1', updatedAt: at,
      completedExerciseIdsByLesson: { l1: ['l1-e3'] }, partialLessonResults: {},
    })

    const path = await getOnePageLearningPath(deps, 'user-1', 'course-1', { lessonId: 'l1', exerciseId: 'l1-e1' })

    expect(queueIds(path)).toEqual(['l1-e2', 'l1-e4'])
  })

  it('returns an empty refill at the end of an incomplete course', async () => {
    const { deps } = setup([lesson('l1', 'unit-1', 1, 3), lesson('l3', 'unit-2', 1, 3)])

    const path = await getOnePageLearningPath(deps, 'user-1', 'course-1', { lessonId: 'l1', exerciseId: 'l1-e3' })

    expect(path.selectedCourseId).toBe('course-1')
    expect(path.queue).toEqual([])
  })

  it('wraps a replay course to its start and repeats it to fill the queue', async () => {
    const { deps, completeLesson } = setup([lesson('l1', 'unit-1', 1, 4)])
    await completeLesson('l1')

    const path = await getOnePageLearningPath(deps, 'user-1', 'course-1', { lessonId: 'l1', exerciseId: 'l1-e3' })

    expect(queueIds(path)).toEqual([
      'l1-e4', 'l1-e1', 'l1-e2', 'l1-e3', 'l1-e4', 'l1-e1', 'l1-e2', 'l1-e3', 'l1-e4', 'l1-e1',
    ])
  })

  it('keeps the requested course for a refill after it stops being selectable', async () => {
    const { deps, completeLesson } = setup([lesson('l1', 'unit-1', 1, 2), lesson('l3', 'unit-2', 1, 2)])
    await completeLesson('l1')

    const initial = await getOnePageLearningPath(deps, 'user-1', 'course-1')
    const refill = await getOnePageLearningPath(deps, 'user-1', 'course-1', { lessonId: 'l1', exerciseId: 'l1-e2' })

    expect(initial.selectedCourseId).toBe('course-2')
    expect(refill.selectedCourseId).toBe('course-1')
  })
})
