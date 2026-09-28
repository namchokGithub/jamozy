import type { GuestMigrationSnapshot, MigrationMarker } from '../models/guest-migration'
import type { SessionSubmissionOutcome } from './session-submission-repository'

export interface AccountMigrationRepository {
  getMarker(accountId: string, guestId: string): Promise<MigrationMarker | null>
  mergeInitialState(accountId: string, guestId: string, snapshot: GuestMigrationSnapshot): Promise<void>
  migrateSessionOutcome(accountId: string, outcome: SessionSubmissionOutcome): Promise<void>
  markComplete(marker: MigrationMarker): Promise<void>
}
