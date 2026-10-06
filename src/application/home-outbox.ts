import { ValidationError } from '../domain/errors'
import type { ExerciseResult } from '../domain/korean/lesson-session'
import type {
  HomeSessionTotals,
  HomeSyncJob,
} from '../domain/models/home-sync-job'
import type { HomeSyncJobRepository } from '../domain/repositories/home-sync-job-repository'
import {
  recordHomeExercise,
  type RecordHomeExerciseDeps,
} from './record-home-exercise'
import { submitHomeReplay } from './submit-home-replay'

const FIRST_RETRY_MS = 1000
const MAX_RETRY_MS = 5 * 60 * 1000

export interface HomeOutboxDeps {
  jobs: HomeSyncJobRepository
  useCases: RecordHomeExerciseDeps
  getActiveUser: () => Promise<{ uid: string }>
  /** Runs `run` after `delayMs`; the outbox calls it to retry a failed job. */
  schedule: (run: () => void, delayMs: number) => void
  now?: () => Date
  newId?: () => string
  /** Called for a job that can never succeed and was discarded. */
  onDropped?: (job: HomeSyncJob, error: unknown) => void
}

// Durable queue for every Home write (DEC-043). Learning never waits on it:
// jobs run oldest first in the background, a failure keeps its job and
// retries with backoff, and each use case is idempotent so a re-run is safe.
export class HomeOutbox {
  private draining: Promise<void> | null = null
  private drainAgain = false

  constructor(private readonly deps: HomeOutboxDeps) {}

  async enqueueExercise(input: {
    userId: string
    lesson: { id: string; exercises: Array<{ id: string }> }
    result: ExerciseResult
    submissionId: string
  }): Promise<void> {
    await this.enqueue({
      ...this.newJob(input.userId),
      kind: 'exercise',
      lesson: input.lesson,
      result: input.result,
      submissionId: input.submissionId,
    })
  }

  async enqueueReplay(input: {
    userId: string
    lessonId: string
    sessionId: string
    totals: HomeSessionTotals
  }): Promise<void> {
    await this.enqueue({
      ...this.newJob(input.userId),
      kind: 'replay',
      lessonId: input.lessonId,
      sessionId: input.sessionId,
      totals: input.totals,
    })
  }

  /** Exercises recorded locally but not yet written, per lesson. */
  async pendingExerciseIds(userId: string): Promise<Map<string, Set<string>>> {
    const pending = new Map<string, Set<string>>()
    for (const job of await this.deps.jobs.list()) {
      if (job.kind !== 'exercise' || job.userId !== userId) continue
      const ids = pending.get(job.lesson.id) ?? new Set<string>()
      ids.add(job.result.exerciseId)
      pending.set(job.lesson.id, ids)
    }
    return pending
  }

  /** Runs due jobs for the active user. Concurrent calls share one run. */
  drain(): Promise<void> {
    if (this.draining) {
      this.drainAgain = true
      return this.draining
    }
    this.draining = (async () => {
      do {
        this.drainAgain = false
        await this.runDueJobs()
      } while (this.drainAgain)
    })().finally(() => {
      this.draining = null
    })
    return this.draining
  }

  private async runDueJobs(): Promise<void> {
    const { uid } = await this.deps.getActiveUser()
    // Another user's jobs wait until that user is active again; their writes
    // belong to that user's storage.
    const jobs = (await this.deps.jobs.list()).filter(
      (job) => job.userId === uid,
    )
    for (const job of jobs) {
      const now = this.now()
      if (job.nextAttemptAt && job.nextAttemptAt > now) {
        this.retryIn(job.nextAttemptAt.getTime() - now.getTime())
        return
      }
      try {
        await this.run(job)
        await this.deps.jobs.remove(job)
      } catch (error) {
        if (error instanceof ValidationError) {
          await this.deps.jobs.remove(job)
          this.deps.onDropped?.(job, error)
          continue
        }
        // Later jobs wait so a lesson's writes stay in order.
        const delayMs = Math.min(
          FIRST_RETRY_MS * 2 ** job.attempts,
          MAX_RETRY_MS,
        )
        await this.deps.jobs.save({
          ...job,
          attempts: job.attempts + 1,
          nextAttemptAt: new Date(now.getTime() + delayMs),
        })
        this.retryIn(delayMs)
        return
      }
    }
  }

  private async run(job: HomeSyncJob): Promise<void> {
    if (job.kind === 'exercise') {
      await recordHomeExercise(this.deps.useCases, {
        userId: job.userId,
        lesson: job.lesson,
        result: job.result,
        submissionId: job.submissionId,
        now: job.enqueuedAt,
      })
      return
    }
    await submitHomeReplay(this.deps.useCases, {
      userId: job.userId,
      lessonId: job.lessonId,
      sessionId: job.sessionId,
      totals: job.totals,
      now: job.enqueuedAt,
    })
  }

  private async enqueue(job: HomeSyncJob): Promise<void> {
    await this.deps.jobs.save(job)
    void this.drain()
  }

  private newJob(userId: string) {
    return {
      id: this.deps.newId?.() ?? crypto.randomUUID(),
      userId,
      enqueuedAt: this.now(),
      attempts: 0,
      nextAttemptAt: null,
    }
  }

  private retryIn(delayMs: number) {
    this.deps.schedule(() => void this.drain(), delayMs)
  }

  private now() {
    return this.deps.now?.() ?? new Date()
  }
}
