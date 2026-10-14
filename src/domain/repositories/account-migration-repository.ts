import type {
  GuestMigrationSnapshot,
  MigrationMarker,
} from '../models/guest-migration'
import type { SessionSubmissionOutcome } from './session-submission-repository'
import type { RebirthRecord } from '../models/rebirth'

export interface AccountMigrationRepository {
  getMarker(accountId: string, guestId: string): Promise<MigrationMarker | null>
  mergeInitialState(
    accountId: string,
    guestId: string,
    snapshot: GuestMigrationSnapshot,
  ): Promise<void>
  migrateSessionOutcome(
    accountId: string,
    guestId: string,
    outcome: SessionSubmissionOutcome,
  ): Promise<void>
  migrateRebirth(
    accountId: string,
    guestId: string,
    record: RebirthRecord,
  ): Promise<void>
  reconcileRebirths(accountId: string): Promise<void>
  markComplete(marker: MigrationMarker): Promise<void>
}
