import type { RebirthResult } from '../domain/models/rebirth'
import type { RebirthRepository } from '../domain/repositories/rebirth-repository'

export async function rebirth(
  deps: { rebirthRepo: RebirthRepository },
  userId: string,
  operationId: string,
  now: Date = new Date(),
): Promise<RebirthResult> {
  if (!operationId.trim()) throw new Error('A rebirth operation ID is required')
  return deps.rebirthRepo.rebirth(userId, operationId, now)
}
