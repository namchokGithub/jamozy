import { describe, expect, it } from 'vitest'
import { LocalHomeStateRepository } from './local-home-state-repository'
import type { Progress } from '../../domain/models/progress'

class MemoryDatabase {
  private values = new Map<string, unknown>()
  async get<T>(store: string, key: string) {
    return (this.values.get(`${store}/${key}`) as T | undefined) ?? null
  }
  async put<T>(store: string, key: string, value: T) {
    this.values.set(`${store}/${key}`, value)
  }
}

const progress: Progress = {
  lessonId: 'l1',
  status: 'unlocked',
  bestAccuracy: 0,
  bestSpeedWpm: 0,
  attempts: 0,
  lastAttemptAt: null,
  completedAt: null,
  completedExerciseIds: ['e1'],
}

describe('LocalHomeStateRepository', () => {
  it('keeps cached progress and the resume pointer per user', async () => {
    const repo = new LocalHomeStateRepository(new MemoryDatabase() as never)

    expect(await repo.getCachedProgress('u1')).toEqual([])
    expect(await repo.getResume('u1')).toBeNull()

    await repo.saveCachedProgress('u1', [progress])
    await repo.saveResume('u1', { unitId: 'u1', lessonId: 'l1' })

    expect(await repo.getCachedProgress('u1')).toEqual([progress])
    expect(await repo.getResume('u1')).toEqual({ unitId: 'u1', lessonId: 'l1' })
    expect(await repo.getCachedProgress('u2')).toEqual([])
  })
})
