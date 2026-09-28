import type { GuestMigrationSnapshot, MigrationCheckpoint } from '../../domain/models/guest-migration'
import type { LearningSession } from '../../domain/models/learning-session'
import type { Progress } from '../../domain/models/progress'
import type { ReviewItem } from '../../domain/models/review-item'
import type { SessionSubmissionOutcome } from '../../domain/repositories/session-submission-repository'
import type { UserProfile } from '../../domain/models/user-profile'
import type { GuestMigrationRepository } from '../../domain/repositories/guest-migration-repository'
import { GuestDatabase, guestDatabase } from './guest-database'

const userPrefix = (guestId: string) => `${guestId}:`
const checkpointKey = (guestId: string, accountId: string) => `${guestId}:${accountId}`

export class LocalGuestMigrationRepository implements GuestMigrationRepository {
  constructor(private database: GuestDatabase = guestDatabase) {}

  async getSnapshot(guestId: string): Promise<GuestMigrationSnapshot> {
    const prefix = userPrefix(guestId)
    const [profile, progress, reviewItems, sessions, sessionOutcomes] = await Promise.all([
      this.database.get<UserProfile>('profiles', prefix),
      this.database.getAll<Progress>('progress', prefix),
      this.database.getAll<ReviewItem>('reviewItems', prefix),
      this.database.getAll<LearningSession>('learningSessions', prefix),
      this.database.getAll<SessionSubmissionOutcome>('sessionOutcomes', prefix),
    ])
    return { guestId, profile, progress, reviewItems, sessions, sessionOutcomes }
  }

  getCheckpoint(guestId: string, accountId: string) {
    return this.database.get<MigrationCheckpoint>('migrationCheckpoints', checkpointKey(guestId, accountId))
  }

  async saveCheckpoint(checkpoint: MigrationCheckpoint): Promise<void> {
    await this.database.put('migrationCheckpoints', checkpointKey(checkpoint.guestId, checkpoint.accountId), checkpoint)
  }
}
