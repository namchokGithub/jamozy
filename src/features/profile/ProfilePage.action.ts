import type { ActionFunctionArgs } from 'react-router'
import { rebirth } from '../../application/rebirth'
import type { RebirthRepository } from '../../domain/repositories/rebirth-repository'

export type RebirthActionData = Awaited<ReturnType<typeof rebirth>> | { error: string }

export function createRebirthAction(deps: { rebirthRepo: RebirthRepository; ensureUser: () => Promise<{ uid: string }> }) {
  return async ({ request }: ActionFunctionArgs): Promise<RebirthActionData> => {
    try {
      const { operationId } = await request.json() as { operationId?: string }
      const user = await deps.ensureUser()
      return await rebirth(deps, user.uid, operationId ?? '')
    } catch {
      return { error: 'Could not complete Rebirth' }
    }
  }
}
