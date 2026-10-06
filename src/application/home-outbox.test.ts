import { describe, expect, it } from 'vitest'
import { HomeOutbox } from './home-outbox'
import {
  FakeHomeSyncJobRepository,
  FakeProgressRepository,
  FakeSessionSubmissionRepository,
  FakeUserProfileRepository,
} from '../test/fakes'
import type { ExerciseResult } from '../domain/korean/lesson-session'
import type { LearningSession } from '../domain/models/learning-session'
import type { SessionSubmissionEffects } from '../domain/repositories/session-submission-repository'

const lesson = { id: 'lesson-1', exercises: [{ id: 'e1' }, { id: 'e2' }] }
const result = (exerciseId: string): ExerciseResult => ({
  exerciseId,
  targetText: '가',
  correctKeyCount: 2,
  mistakes: [],
})

class FlakySubmissions extends FakeSessionSubmissionRepository {
  failuresLeft = 0
  override async submit(
    userId: string,
    session: LearningSession,
    effects: SessionSubmissionEffects,
  ) {
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1
      throw new Error('offline')
    }
    return super.submit(userId, session, effects)
  }
}

function setup(
  options: {
    uid?: string
    jobs?: FakeHomeSyncJobRepository
    onDropped?: (job: { id: string }) => void
  } = {},
) {
  const progressRepo = new FakeProgressRepository()
  const sessionSubmissionRepo = new FlakySubmissions(progressRepo)
  const jobs = options.jobs ?? new FakeHomeSyncJobRepository()
  const scheduled: number[] = []
  let clock = new Date('2026-10-06T00:00:00.000Z').getTime()
  let ids = 0
  const outbox = new HomeOutbox({
    jobs,
    useCases: {
      progressRepo,
      userProfileRepo: new FakeUserProfileRepository(),
      sessionSubmissionRepo,
    },
    getActiveUser: async () => ({ uid: options.uid ?? 'u1' }),
    now: () => new Date(clock),
    newId: () => `job-${(ids += 1)}`,
    schedule: (_run, delayMs) => {
      scheduled.push(delayMs)
    },
    onDropped: options.onDropped,
  })
  return {
    outbox,
    jobs,
    progressRepo,
    sessionSubmissionRepo,
    scheduled,
    advance: (ms: number) => {
      clock += ms
    },
  }
}

describe('HomeOutbox', () => {
  it('runs queued exercises in order and removes them once written', async () => {
    const { outbox, jobs, progressRepo, sessionSubmissionRepo } = setup()

    await outbox.enqueueExercise({
      userId: 'u1',
      lesson,
      result: result('e1'),
      submissionId: 's1',
    })
    await outbox.enqueueExercise({
      userId: 'u1',
      lesson,
      result: result('e2'),
      submissionId: 's2',
    })
    await outbox.drain()

    expect(jobs.jobs).toEqual([])
    expect((await progressRepo.getProgress('u1', 'lesson-1'))?.status).toBe(
      'completed',
    )
    expect(
      sessionSubmissionRepo.submissions.map(({ session }) => session.id),
    ).toEqual(['s1'])
  })

  it('keeps a failed job, backs off, and succeeds on a later drain', async () => {
    const {
      outbox,
      jobs,
      progressRepo,
      sessionSubmissionRepo,
      scheduled,
      advance,
    } = setup()
    sessionSubmissionRepo.failuresLeft = 1

    await outbox.enqueueExercise({
      userId: 'u1',
      lesson,
      result: result('e1'),
      submissionId: 's1',
    })
    await outbox.enqueueExercise({
      userId: 'u1',
      lesson,
      result: result('e2'),
      submissionId: 's2',
    })
    await outbox.drain()

    expect(jobs.jobs.map(({ kind, attempts }) => [kind, attempts])).toEqual([
      ['exercise', 1],
    ])
    expect(scheduled.at(-1)).toBe(1000)

    await outbox.drain()
    expect(jobs.jobs).toHaveLength(1)

    advance(1000)
    await outbox.drain()
    expect(jobs.jobs).toEqual([])
    expect((await progressRepo.getProgress('u1', 'lesson-1'))?.status).toBe(
      'completed',
    )
  })

  it('doubles the stored backoff after each failure, up to five minutes', async () => {
    const { outbox, jobs, sessionSubmissionRepo, advance } = setup()
    sessionSubmissionRepo.failuresLeft = 20
    const oneExercise = { id: 'lesson-2', exercises: [{ id: 'only' }] }
    await outbox.enqueueExercise({
      userId: 'u1',
      lesson: oneExercise,
      result: result('only'),
      submissionId: 's1',
    })
    await outbox.drain()

    const delays: number[] = []
    let clock = new Date('2026-10-06T00:00:00.000Z').getTime()
    for (let index = 0; index < 10; index += 1) {
      delays.push(jobs.jobs[0].nextAttemptAt!.getTime() - clock)
      advance(300_000)
      clock += 300_000
      await outbox.drain()
    }

    expect(delays.slice(0, 4)).toEqual([1000, 2000, 4000, 8000])
    expect(Math.max(...delays)).toBe(300_000)
    expect(jobs.jobs[0].attempts).toBe(11)
  })

  it('survives a new outbox instance over the same durable jobs', async () => {
    const jobs = new FakeHomeSyncJobRepository()
    const first = setup({ jobs })
    first.sessionSubmissionRepo.failuresLeft = 1
    await first.outbox.enqueueExercise({
      userId: 'u1',
      lesson,
      result: result('e1'),
      submissionId: 's1',
    })
    await first.outbox.enqueueExercise({
      userId: 'u1',
      lesson,
      result: result('e2'),
      submissionId: 's2',
    })
    await first.outbox.drain()
    expect(jobs.jobs).toHaveLength(1)

    const second = setup({ jobs })
    second.advance(60_000)
    await second.outbox.drain()

    expect(jobs.jobs).toEqual([])
  })

  it('drops a job that can never succeed and continues', async () => {
    const dropped: string[] = []
    const { outbox, jobs, progressRepo } = setup({
      onDropped: (job) => {
        dropped.push(job.id)
      },
    })

    await outbox.enqueueExercise({
      userId: 'u1',
      lesson,
      result: result('removed-exercise'),
      submissionId: 's1',
    })
    await outbox.enqueueExercise({
      userId: 'u1',
      lesson,
      result: result('e1'),
      submissionId: 's2',
    })
    await outbox.drain()

    expect(dropped).toEqual(['job-1'])
    expect(jobs.jobs).toEqual([])
    expect(
      (await progressRepo.getProgress('u1', 'lesson-1'))?.completedExerciseIds,
    ).toEqual(['e1'])
  })

  it("leaves another user's jobs until that user is active", async () => {
    const { outbox, jobs } = setup({ uid: 'account' })

    await outbox.enqueueExercise({
      userId: 'guest',
      lesson,
      result: result('e1'),
      submissionId: 's1',
    })
    await outbox.drain()

    expect(jobs.jobs.map(({ userId }) => userId)).toEqual(['guest'])
  })

  it('reports exercises still waiting to sync, per lesson', async () => {
    const { outbox, sessionSubmissionRepo } = setup()
    sessionSubmissionRepo.failuresLeft = 1
    await outbox.enqueueExercise({
      userId: 'u1',
      lesson,
      result: result('e1'),
      submissionId: 's1',
    })
    await outbox.enqueueExercise({
      userId: 'u1',
      lesson,
      result: result('e2'),
      submissionId: 's2',
    })
    await outbox.drain()

    expect(await outbox.pendingExerciseIds('u1')).toEqual(
      new Map([['lesson-1', new Set(['e2'])]]),
    )
    expect(await outbox.pendingExerciseIds('other')).toEqual(new Map())
  })
})
