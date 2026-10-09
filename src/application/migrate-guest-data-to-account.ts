import type { AccountMigrationRepository } from '../domain/repositories/account-migration-repository'
import type { GuestMigrationRepository } from '../domain/repositories/guest-migration-repository'

export interface MigrationResult {
  migrated: boolean
  sessionCount: number
}

export async function migrateGuestDataToAccount(
  source: GuestMigrationRepository,
  destination: AccountMigrationRepository,
  guestId: string,
  accountId: string,
  now: Date = new Date(),
): Promise<MigrationResult> {
  const marker = await destination.getMarker(accountId, guestId)
  if (marker) return { migrated: false, sessionCount: 0 }
  const snapshot = await source.getSnapshot(guestId)
  await source.saveCheckpoint({ guestId, accountId, status: 'started', updatedAt: now })
  await destination.mergeInitialState(accountId, guestId, snapshot)
  for (const outcome of [...snapshot.sessionOutcomes].sort(
    (left, right) => left.session.completedAt.getTime() - right.session.completedAt.getTime(),
  )) {
    await destination.migrateSessionOutcome(accountId, outcome)
  }
  await destination.markComplete({ guestId, accountId, completedAt: now })
  await source.saveCheckpoint({ guestId, accountId, status: 'completed', updatedAt: now })
  return { migrated: true, sessionCount: snapshot.sessionOutcomes.length }
}
