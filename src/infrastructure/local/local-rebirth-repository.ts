import type { RebirthResult } from '../../domain/models/rebirth'
import type { RebirthRepository } from '../../domain/repositories/rebirth-repository'
import { GuestDatabase, guestDatabase } from './guest-database'

export class LocalRebirthRepository implements RebirthRepository {
  constructor(private readonly database: GuestDatabase = guestDatabase) {}

  rebirth(userId: string, operationId: string, now: Date): Promise<RebirthResult> {
    return this.database.rebirth(userId, operationId, now)
  }
}
