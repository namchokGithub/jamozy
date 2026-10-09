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

  it('accumulates exercise stats across visits and submits them on completion', async () => {
    const { deps, submissions } = setup()
    const wordLesson = { ...lesson, type: 'word' as const }
    const timed = (id: string, typingSeconds: number, elapsedSeconds: number) => ({ ...result(id), typingSeconds, elapsedSeconds })

    await recordHomeExercise(deps, { userId: 'u1', lesson: wordLesson, result: timed('e1', 2, 3), submissionId: 's1', now: new Date('2026-10-09T01:00:00Z') })
    await recordHomeExercise(deps, { userId: 'u1', lesson: wordLesson, result: timed('e2', 1, 2), submissionId: 's2', now: new Date('2026-10-09T01:01:00Z') })
    // The last exercise comes back the next day: learning time must not
    // include the night in between.
    await recordHomeExercise(deps, { userId: 'u1', lesson: wordLesson, result: timed('e3', 3, 4), submissionId: 's3', now: new Date('2026-10-10T09:00:00Z') })

    expect(submissions[0].session).toMatchObject({
      typingSeconds: 6,
      learningSeconds: 9,
      charactersTyped: 3,
      wordsPracticed: 3,
      exerciseMistakes: [0, 0, 0],
      isReplay: false,
    })
  })

  it('submits a job queued before stats existed, without a type or timing', async () => {
    const { deps, submissions } = setup()
    for (const id of ['e1', 'e2', 'e3'])
      await recordHomeExercise(deps, { userId: 'u1', lesson, result: result(id), submissionId: `s-${id}`, now: at(0) })

    expect(submissions[0].session).toMatchObject({
      typingSeconds: 0,
      learningSeconds: 0,
      wordsPracticed: 0,
      sentencesPracticed: 0,
      charactersTyped: 3,
    })
  })

  it('accumulates jamo counts across exercises and submits them on completion', async () => {
    const { deps, submissions } = setup()
    for (const id of ['e1', 'e2', 'e3'])
      await recordHomeExercise(deps, { userId: 'u1', lesson, result: result(id, 2, id === 'e2' ? 1 : 0), submissionId: `s-${id}`, now: at(0) })
    // Each target is '가'; the mistake fixture expects ㄱ.
    expect(submissions[0].effects.jamoCounts).toEqual({ ㄱ: { accepted: 3, rejected: 1 }, ㅏ: { accepted: 3, rejected: 0 } })
  })

  it('counts only new exercises for a partial result saved before jamo counts', async () => {
    const { deps, progressRepo, submissions } = setup()
    await progressRepo.saveProgress('u1', {
      lessonId: 'lesson-1', status: 'unlocked', bestAccuracy: 0, bestSpeedWpm: 0, attempts: 0, lastAttemptAt: at(0), completedAt: null,
      completedExerciseIds: ['e1', 'e2'],
      homePartialResult: { submissionId: 's-old', startedAtMs: at(0).getTime(), acceptedKeystrokes: 4, rejectedKeystrokes: 0 },
    })
    await recordHomeExercise(deps, { userId: 'u1', lesson, result: result('e3'), submissionId: 'x', now: at(10) })
    expect(submissions[0].effects.jamoCounts).toEqual({ ㄱ: { accepted: 1, rejected: 0 }, ㅏ: { accepted: 1, rejected: 0 } })
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

  it('marks a replay and counts sentences from the lesson type', async () => {
    const { deps, submissions } = await completedSetup()

    await submitHomeReplay(deps, {
      userId: 'u1',
      lessonId: 'lesson-1',
      sessionId: 'replay-1',
      totals: {
        ...totals,
        exercises: [
          { targetText: '안녕 하세요', mistakeCount: 0, typingSeconds: 2, elapsedSeconds: 3 },
        ],
      },
      lessonType: 'sentence',
      now: at(130),
    })

    expect(submissions.at(-1)?.session).toMatchObject({
      isReplay: true,
      sentencesPracticed: 1,
      charactersTyped: 5,
      learningSeconds: 3,
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
