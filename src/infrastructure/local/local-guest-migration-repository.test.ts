import { describe, expect, it } from 'vitest'
import { defaultUserProfile } from '../../domain/models/user-profile'
import { LocalGuestMigrationRepository } from './local-guest-migration-repository'

class MemoryDatabase {
  readonly values = new Map<string, unknown>()
  async get<T>(store: string, key: string) { return (this.values.get(`${store}:${key}`) as T | undefined) ?? null }
  async getAll<T>(store: string, prefix: string) { return [...this.values.entries()].filter(([key]) => key.startsWith(`${store}:${prefix}`)).map(([, value]) => value as T) }
  async put<T>(store: string, key: string, value: T) { this.values.set(`${store}:${key}`, value) }
}

describe('LocalGuestMigrationRepository', () => {
  it('exports only the selected Guest snapshot and keeps records after checkpoint completion', async () => {
    const database = new MemoryDatabase()
    const repository = new LocalGuestMigrationRepository(database as never)
    const date = new Date('2026-01-01')
    await database.put('profiles', 'guest-a:', defaultUserProfile('guest-a', date, 'Guest#0001'))
    await database.put('progress', 'guest-a:lesson-1', { lessonId: 'lesson-1', status: 'completed', bestAccuracy: 100, bestSpeedWpm: 20, attempts: 1, lastAttemptAt: date, completedAt: date })
    await database.put('reviewItems', 'guest-b:exercise-1', { id: 'exercise-1' })

    const snapshot = await repository.getSnapshot('guest-a')
    await repository.saveCheckpoint({ guestId: 'guest-a', accountId: 'account-1', status: 'completed', updatedAt: date })

    expect(snapshot.profile?.displayName).toBe('Guest#0001')
    expect(snapshot.progress).toHaveLength(1)
    expect(snapshot.progress[0]?.completedAt).toEqual(date)
    expect(snapshot.reviewItems).toEqual([])
    expect(await repository.getCheckpoint('guest-a', 'account-1')).toMatchObject({ status: 'completed' })
    expect(await database.get('progress', 'guest-a:lesson-1')).not.toBeNull()
  })
})
