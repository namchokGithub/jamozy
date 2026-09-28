export type UserSession =
  | { kind: 'guest'; userId: string }
  | { kind: 'authenticated'; userId: string }

export interface GuestSession {
  guestId: string
  displayName: string
  createdAt: Date
  lastActiveAt: Date
}

export function createGuestIdentity(crypto: Crypto): {
  guestId: string
  displayName: string
} {
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  const number = values[0] % 10000
  return { guestId: crypto.randomUUID(), displayName: `Guest#${number.toString().padStart(4, '0')}` }
}
