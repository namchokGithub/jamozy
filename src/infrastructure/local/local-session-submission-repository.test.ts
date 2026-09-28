import { describe, expect, it } from 'vitest'
import type { LearningSession } from '../../domain/models/learning-session'
import { LocalSessionSubmissionRepository } from './local-session-submission-repository'

const session: LearningSession = {
  id: 'session-1',
  context: { mode: 'learning-path', lessonId: 'lesson-1' },
  startedAt: new Date('2026-01-01T00:00:00.000Z'),
  completedAt: new Date('2026-01-01T00:01:00.000Z'),
  durationSeconds: 60,
  exercisesAttempted: 1,
  acceptedKeystrokes: 10,
  rejectedKeystrokes: 1,
  expGained: 100,
}

class MemoryCheckpointDatabase {
  readonly calls: Array<{ key: string; effects: unknown }> = []
  private outcomes = new Map<string, unknown>()

  async putSessionOnce<T>(key: string, _session: unknown, outcome: T, effects: unknown): Promise<{ outcome: T; inserted: boolean }> {
    this.calls.push({ key, effects })
    const existing = this.outcomes.get(key) as T | undefined
    if (existing) return { outcome: existing, inserted: false }
    this.outcomes.set(key, outcome)
    return { outcome, inserted: true }
  }
}

describe('LocalSessionSubmissionRepository', () => {
  it('returns the original outcome and does not apply effects again for the same session ID', async () => {
    const database = new MemoryCheckpointDatabase()
    const repository = new LocalSessionSubmissionRepository(database as never)
    const effects = { progress: [], reviewItems: [] }

    const initial = await repository.submit('guest-1', session, effects)
    const retry = await repository.submit('guest-1', session, effects)

    expect(initial.wasDuplicate).toBe(false)
    expect(retry.wasDuplicate).toBe(true)
    expect(retry.aggregate).toEqual(initial.aggregate)
    expect(database.calls).toHaveLength(2)
  })

  it('treats a different session ID as a new checkpoint', async () => {
    const database = new MemoryCheckpointDatabase()
    const repository = new LocalSessionSubmissionRepository(database as never)

    await repository.submit('guest-1', session, { progress: [], reviewItems: [] })
    const replay = await repository.submit('guest-1', { ...session, id: 'session-2' }, { progress: [], reviewItems: [] })

    expect(replay.wasDuplicate).toBe(false)
  })
})
