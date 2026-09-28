import type { GuestMigrationSnapshot, MigrationCheckpoint } from '../models/guest-migration'

export interface GuestMigrationRepository {
  getSnapshot(guestId: string): Promise<GuestMigrationSnapshot>
  getCheckpoint(guestId: string, accountId: string): Promise<MigrationCheckpoint | null>
  saveCheckpoint(checkpoint: MigrationCheckpoint): Promise<void>
}
