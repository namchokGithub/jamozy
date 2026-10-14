import type { RebirthResult } from '../models/rebirth'

export interface RebirthRepository {
  rebirth(userId: string, operationId: string, now: Date): Promise<RebirthResult>
}
