import { describe, expect, it, vi } from 'vitest'
import { parseAdminClaimArgs, setAdminClaim } from './set-admin-claim'

describe('setAdminClaim', () => {
  it('accepts a UID forwarded by pnpm after its separator', () => {
    expect(parseAdminClaimArgs(['--', 'owner-uid'])).toBe('owner-uid')
  })

  it('sets the admin claim for the supplied Auth UID', async () => {
    const setCustomUserClaims = vi.fn().mockResolvedValue(undefined)
    await setAdminClaim('owner-uid', {
      getUser: vi.fn().mockResolvedValue({ customClaims: { editor: true } }),
      setCustomUserClaims,
    })
    expect(setCustomUserClaims).toHaveBeenCalledWith('owner-uid', {
      editor: true,
      admin: true,
    })
  })

  it('rejects a missing Auth UID', async () => {
    await expect(
      setAdminClaim(' ', { getUser: vi.fn(), setCustomUserClaims: vi.fn() }),
    ).rejects.toThrow('Provide a Firebase Auth UID')
  })
})
