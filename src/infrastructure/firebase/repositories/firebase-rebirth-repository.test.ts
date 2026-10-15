import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  defaultUserProfile,
  expRequiredForNextLevel,
} from '../../../domain/models/user-profile'

const state = vi.hoisted(() => ({
  documents: new Map<string, Record<string, unknown>>(),
  tail: Promise.resolve(),
}))
const persist = (value: unknown): unknown => {
  if (value instanceof Date) return { toDate: () => value }
  if (Array.isArray(value)) return value.map(persist)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, persist(item)]),
    )
  return value
}

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => path.join('/'),
  runTransaction: async (
    _db: unknown,
    callback: (transaction: {
      get(
        ref: string,
      ): Promise<{ exists(): boolean; data(): Record<string, unknown> }>
      set(ref: string, value: Record<string, unknown>): void
    }) => Promise<unknown>,
  ) => {
    const previous = state.tail
    let release: () => void = () => undefined
    state.tail = new Promise<void>((resolve) => {
      release = resolve
    })
    await previous
    const writes = new Map<string, Record<string, unknown>>()
    try {
      return await callback({
        get: async (ref) => {
          const value = state.documents.get(ref)
          return { exists: () => value !== undefined, data: () => value ?? {} }
        },
        set: (ref, value) => writes.set(ref, value),
      })
    } finally {
      for (const [ref, value] of writes)
        state.documents.set(ref, persist(value) as Record<string, unknown>)
      release()
    }
  },
}))
vi.mock('../firebase', () => ({ db: {} }))

import { FirebaseRebirthRepository } from './firebase-rebirth-repository'

const expAtLevel100 = Array.from({ length: 99 }, (_, index) =>
  expRequiredForNextLevel(index + 1),
).reduce((total, exp) => total + exp, 0)
const timestamp = (value: Date) => ({ toDate: () => value })

describe('FirebaseRebirthRepository', () => {
  beforeEach(() => {
    state.documents.clear()
    state.tail = Promise.resolve()
    const profile = defaultUserProfile('u1', new Date('2026-01-01'))
    profile.progression = {
      ...profile.progression!,
      currentExp: expAtLevel100,
      totalExpEarned: expAtLevel100,
      highestLevel: 100,
    }
    state.documents.set('users/u1', {
      ...profile,
      createdAt: timestamp(profile.createdAt),
      updatedAt: timestamp(profile.updatedAt!),
    })
  })

  it('returns the existing record when an operation ID is retried', async () => {
    const repository = new FirebaseRebirthRepository()
    await repository.rebirth('u1', 'retry-id', new Date('2026-10-14'))
    const retry = await repository.rebirth(
      'u1',
      'retry-id',
      new Date('2026-10-14'),
    )

    expect(retry).toMatchObject({
      status: 'already-applied',
      record: { id: 'retry-id', rebirthNumber: 1 },
    })
    expect(state.documents.get('users/u1')?.progression).toMatchObject({
      rebirthCount: 1,
      perkPointsEarned: 1,
    })
  })

  it('allows only one Rebirth when two operation IDs arrive together', async () => {
    const repository = new FirebaseRebirthRepository()
    const results = await Promise.all([
      repository.rebirth('u1', 'first', new Date('2026-10-14')),
      repository.rebirth('u1', 'second', new Date('2026-10-14')),
    ])

    expect(results.map((result) => result.status).sort()).toEqual([
      'ineligible',
      'rebirthed',
    ])
    expect(
      [...state.documents.keys()].filter((key) =>
        key.startsWith('users/u1/rebirths/'),
      ),
    ).toHaveLength(1)
  })
})
