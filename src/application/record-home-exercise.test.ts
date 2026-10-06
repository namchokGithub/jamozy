import { describe, expect, it } from 'vitest'
import { recordHomeExercise } from './record-home-exercise'
import { submitHomeReplay } from './submit-home-replay'
import {
  FakeProgressRepository,
  FakeSessionSubmissionRepository,
  FakeUserProfileRepository,
} from '../test/fakes'
import type { ExerciseResult } from '../domain/korean/lesson-session'

const lesson = {
  id: 'lesson-1',
  exercises: [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }],
}

function setup() {
  const progressRepo = new FakeProgressRepository()
  const deps = {
    progressRepo,
    userProfileRepo: new FakeUserProfileRepository(),
    sessionSubmissionRepo: new FakeSessionSubmissionRepository(progressRepo),
  }
  return {
    deps,
    progressRepo,
    submissions: deps.sessionSubmissionRepo.submissions,
  }
}

function result(
  exerciseId: string,
  correctKeyCount = 4,
  mistakes = 0,
): ExerciseResult {
  return {
    exerciseId,
    targetText: '가',
    correctKeyCount,
    mistakes: Array.from({ length: mistakes }, () => ({
      syllableIndex: 0,
      expectedCode: 'KeyR',
      expectedShift: false,
      expectedJamo: 'ㄱ',
      pressedCode: 'KeyS',
      pressedShift: false,
    })),
  }
}

const at = (seconds: number) => new Date(Date.UTC(2026, 9, 6, 0, 0, seconds))

describe('recordHomeExercise', () => {
  it('records distinct completed exercises and a partial result without submitting', async () => {
    const { deps, progressRepo, submissions } = setup()

    await recordHomeExercise(deps, {
      userId: 'u1',
      lesson,
      result: result('e1', 4, 1),
      submissionId: 's1',
      now: at(0),
    })
    await recordHomeExercise(deps, {
      userId: 'u1',
      lesson,
      result: result('e2', 6),
      submissionId: 's2',
      now: at(10),
    })

    const progress = await progressRepo.getProgress('u1', 'lesson-1')
    expect(progress).toMatchObject({
      status: 'unlocked',
      completedExerciseIds: ['e1', 'e2'],
      homePartialResult: {
        submissionId: 's1',
        startedAtMs: at(0).getTime(),
        acceptedKeystrokes: 10,
        rejectedKeystrokes: 1,
      },
    })
    expect(submissions).toEqual([])
  })

  it('does not count a repeated exercise twice', async () => {
    const { deps, progressRepo } = setup()

    await recordHomeExercise(deps, {
      userId: 'u1',
      lesson,
      result: result('e1'),
      submissionId: 's1',
      now: at(0),
    })
    await recordHomeExercise(deps, {
      userId: 'u1',
      lesson,
      result: result('e1', 9),
      submissionId: 's2',
      now: at(5),
    })

    expect(await progressRepo.getProgress('u1', 'lesson-1')).toMatchObject({
      completedExerciseIds: ['e1'],
      homePartialResult: { acceptedKeystrokes: 4 },
    })
  })

  it('submits one first-completion session when every exercise is covered', async () => {
    const { deps, progressRepo, submissions } = setup()

    await recordHomeExercise(deps, {
      userId: 'u1',
      lesson,
      result: result('e1', 4),
      submissionId: 's1',
      now: at(0),
    })
    await recordHomeExercise(deps, {
      userId: 'u1',
      lesson,
      result: result('e2', 4),
      submissionId: 's2',
      now: at(30),
    })
    const outcome = await recordHomeExercise(deps, {
      userId: 'u1',
      lesson,
      result: result('e3', 2),
      submissionId: 's3',
      now: at(60),
    })

    expect(submissions).toHaveLength(1)
    expect(submissions[0].session).toMatchObject({
      id: 's1',
      context: { mode: 'home', lessonId: 'lesson-1' },
      startedAt: at(0),
      completedAt: at(60),
      durationSeconds: 60,
      exercisesAttempted: 3,
      acceptedKeystrokes: 10,
      rejectedKeystrokes: 0,
      expGained: 170,
    })
    expect(submissions[0].effects.reviewItems).toEqual([])
    expect(outcome.completed?.expGained).toBe(170)
    const progress = await progressRepo.getProgress('u1', 'lesson-1')
    expect(progress).toMatchObject({
      status: 'completed',
      completedAt: at(60),
      completedExerciseIds: ['e1', 'e2', 'e3'],
      attempts: 1,
    })
    expect(progress).not.toHaveProperty('homePartialResult')
  })

  it('submits nothing more for exercises played after completion', async () => {
    const { deps, submissions } = setup()
    for (const id of ['e1', 'e2', 'e3'])
      await recordHomeExercise(deps, {
        userId: 'u1',
        lesson,
        result: result(id),
        submissionId: `s-${id}`,
        now: at(0),
      })

    await recordHomeExercise(deps, {
      userId: 'u1',
      lesson,
      result: result('e2'),
      submissionId: 's-again',
      now: at(90),
    })

    expect(submissions).toHaveLength(1)
  })

  it('rejects an exercise that is not part of the lesson', async () => {
    const { deps } = setup()
    await expect(
      recordHomeExercise(deps, {
        userId: 'u1',
        lesson,
        result: result('other'),
        submissionId: 's1',
        now: at(0),
      }),
    ).rejects.toThrow('Exercise other does not belong to lesson lesson-1')
  })
})

describe('submitHomeReplay', () => {
  const totals = {
    startedAtMs: at(100).getTime(),
    durationSeconds: 30,
    exercisesAttempted: 3,
    acceptedKeystrokes: 12,
    rejectedKeystrokes: 3,
  }

  async function completedSetup() {
    const context = setup()
    for (const id of ['e1', 'e2', 'e3'])
      await recordHomeExercise(context.deps, {
        userId: 'u1',
        lesson,
        result: result(id),
        submissionId: `s-${id}`,
        now: at(0),
      })
    return context
  }

  it('grants 15 EXP for a full session of a completed lesson without changing completion', async () => {
    const { deps, progressRepo, submissions } = await completedSetup()
    const before = await progressRepo.getProgress('u1', 'lesson-1')

    const outcome = await submitHomeReplay(deps, {
      userId: 'u1',
      lessonId: 'lesson-1',
      sessionId: 'replay-1',
      totals,
      now: at(130),
    })

    expect(outcome?.expGained).toBe(15)
    expect(submissions.at(-1)?.session).toMatchObject({
      id: 'replay-1',
      context: { mode: 'home', lessonId: 'lesson-1' },
      expGained: 15,
      exercisesAttempted: 3,
    })
    expect(submissions.at(-1)?.effects.reviewItems).toEqual([])
    expect(await progressRepo.getProgress('u1', 'lesson-1')).toMatchObject({
      status: 'completed',
      completedAt: before?.completedAt,
      completedExerciseIds: ['e1', 'e2', 'e3'],
      attempts: 2,
      lastAttemptAt: at(130),
    })
  })

  it('is idempotent by session id', async () => {
    const { deps, submissions } = await completedSetup()

    await submitHomeReplay(deps, {
      userId: 'u1',
      lessonId: 'lesson-1',
      sessionId: 'replay-1',
      totals,
      now: at(130),
    })
    await submitHomeReplay(deps, {
      userId: 'u1',
      lessonId: 'lesson-1',
      sessionId: 'replay-1',
      totals,
      now: at(140),
    })

    expect(
      submissions.filter(({ session }) => session.id === 'replay-1'),
    ).toHaveLength(1)
  })

  it('submits nothing for a lesson that is not completed', async () => {
    const { deps, submissions } = setup()

    const outcome = await submitHomeReplay(deps, {
      userId: 'u1',
      lessonId: 'lesson-1',
      sessionId: 'replay-1',
      totals,
      now: at(130),
    })

    expect(outcome).toBeNull()
    expect(submissions).toEqual([])
  })
})
