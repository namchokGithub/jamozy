import { describe, expect, it } from 'vitest'
import { LocalHomeSyncJobRepository } from './local-home-sync-job-repository'
import type { HomeSyncJob } from '../../domain/models/home-sync-job'

class MemoryDatabase {
  private values = new Map<string, unknown>()
  async getAll<T>(_store: string, prefix: string) {
    return [...this.values.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, value]) => value as T)
  }
  async put<T>(_store: string, key: string, value: T) {
    this.values.set(key, value)
  }
  async delete(_store: string, key: string) {
    this.values.delete(key)
  }
}

const job = (id: string, enqueuedAt: string): HomeSyncJob => ({
  id,
  userId: 'u1',
  enqueuedAt: new Date(enqueuedAt),
  attempts: 0,
  nextAttemptAt: null,
  kind: 'replay',
  lessonId: 'lesson-1',
  sessionId: id,
  totals: {
    startedAtMs: 0,
    durationSeconds: 1,
    exercisesAttempted: 1,
    acceptedKeystrokes: 1,
    rejectedKeystrokes: 0,
  },
})

describe('LocalHomeSyncJobRepository', () => {
  it('lists jobs oldest first, replaces by job, and removes them', async () => {
    const repo = new LocalHomeSyncJobRepository(new MemoryDatabase() as never)
    await repo.save(job('later', '2026-10-06T00:00:02Z'))
    await repo.save(job('earlier', '2026-10-06T00:00:01Z'))
    await repo.save({ ...job('later', '2026-10-06T00:00:02Z'), attempts: 3 })

    expect(
      (await repo.list()).map(({ id, attempts }) => [id, attempts]),
    ).toEqual([
      ['earlier', 0],
      ['later', 3],
    ])

    await repo.remove(job('earlier', '2026-10-06T00:00:01Z'))
    expect((await repo.list()).map(({ id }) => id)).toEqual(['later'])
  })
})
