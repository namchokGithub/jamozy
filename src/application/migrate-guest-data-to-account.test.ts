import { describe, expect, it } from 'vitest'
import { migrateGuestDataToAccount } from './migrate-guest-data-to-account'
import type { AccountMigrationRepository } from '../domain/repositories/account-migration-repository'
import type { GuestMigrationRepository } from '../domain/repositories/guest-migration-repository'
import type { GuestMigrationSnapshot, MigrationCheckpoint, MigrationMarker } from '../domain/models/guest-migration'

class FakeGuestMigrationRepository implements GuestMigrationRepository {
  readonly checkpoints: MigrationCheckpoint[] = []
  constructor(readonly snapshot: GuestMigrationSnapshot) {}
  async getSnapshot() { return this.snapshot }
  async getCheckpoint(guestId: string, accountId: string) { return this.checkpoints.find((item) => item.guestId === guestId && item.accountId === accountId) ?? null }
  async saveCheckpoint(checkpoint: MigrationCheckpoint) { this.checkpoints.push(checkpoint) }
}

class FakeAccountMigrationRepository implements AccountMigrationRepository {
  marker: MigrationMarker | null = null
  migratedSessions: string[] = []
  initialMergeCount = 0
  async getMarker() { return this.marker }
  async mergeInitialState() { this.initialMergeCount += 1 }
  async migrateSessionOutcome(_accountId: string, outcome: GuestMigrationSnapshot['sessionOutcomes'][number]) { this.migratedSessions.push(outcome.session.id) }
  async markComplete(marker: MigrationMarker) { this.marker = marker }
}

const snapshot: GuestMigrationSnapshot = { guestId: 'guest-1', profile: null, progress: [], reviewItems: [], sessions: [], sessionOutcomes: [] }

describe('migrateGuestDataToAccount', () => {
  it('merges state, records a Cloud marker, and keeps the Guest checkpoint recoverable', async () => {
    const source = new FakeGuestMigrationRepository(snapshot)
    const destination = new FakeAccountMigrationRepository()

    const result = await migrateGuestDataToAccount(source, destination, 'guest-1', 'account-1', new Date('2026-01-01'))

    expect(result).toEqual({ migrated: true, sessionCount: 0 })
    expect(destination.initialMergeCount).toBe(1)
    expect(destination.marker).toMatchObject({ guestId: 'guest-1', accountId: 'account-1' })
    expect(source.checkpoints.at(-1)).toMatchObject({ status: 'completed' })
  })

  it('is a no-op when the Cloud marker already exists', async () => {
    const source = new FakeGuestMigrationRepository(snapshot)
    const destination = new FakeAccountMigrationRepository()
    destination.marker = { guestId: 'guest-1', accountId: 'account-1', completedAt: new Date('2026-01-01') }

    const result = await migrateGuestDataToAccount(source, destination, 'guest-1', 'account-1')

    expect(result).toEqual({ migrated: false, sessionCount: 0 })
    expect(destination.initialMergeCount).toBe(0)
  })

  it('does not mark the local checkpoint complete when Cloud migration fails', async () => {
    const source = new FakeGuestMigrationRepository(snapshot)
    const destination = new FakeAccountMigrationRepository()
    destination.mergeInitialState = async () => { throw new Error('offline') }

    await expect(migrateGuestDataToAccount(source, destination, 'guest-1', 'account-1')).rejects.toThrow('offline')

    expect(source.checkpoints.at(-1)).toMatchObject({ status: 'started' })
    expect(destination.marker).toBeNull()
  })
})
