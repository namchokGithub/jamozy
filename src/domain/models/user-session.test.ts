import { describe, expect, it, vi } from 'vitest'
import { createGuestIdentity } from './user-session'

describe('createGuestIdentity', () => {
  it('creates a UUID and zero-padded Guest display name', () => {
    const crypto = { randomUUID: vi.fn(() => 'guest-id'), getRandomValues: vi.fn((values: Uint32Array) => { values[0] = 42; return values }) } as unknown as Crypto
    expect(createGuestIdentity(crypto)).toEqual({ guestId: 'guest-id', displayName: 'Guest#0042' })
  })
})
