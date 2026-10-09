import { describe, expect, it } from 'vitest'
import { defaultUserProfile } from '../../../domain/models/user-profile'
import type { SessionSubmissionOutcome } from '../../../domain/repositories/session-submission-repository'
import { FirebaseAccountMigrationRepository } from './firebase-account-migration-repository'

const sessionOutcome: SessionSubmissionOutcome = {
  session: { id: 'session-1', context: { mode: 'learning-path', lessonId: 'lesson-1' }, startedAt: new Date('2026-01-01'), completedAt: new Date('2026-01-01T00:01:00'), durationSeconds: 60, exercisesAttempted: 1, acceptedKeystrokes: 10, rejectedKeystrokes: 0, expGained: 100 },
  aggregate: { exp: 100, exercisesAttempted: 1, acceptedKeystrokes: 10, rejectedKeystrokes: 0, totalTypingTimeSeconds: 60, bestAccuracy: 100 },
  effects: { progress: [{ lessonId: 'lesson-1', status: 'completed', bestAccuracy: 100, bestSpeedWpm: 12, attempts: 1, lastAttemptAt: new Date('2026-01-01T00:01:00'), completedAt: new Date('2026-01-01T00:01:00') }], reviewItems: [] },
  wasDuplicate: false,
}

function persist(value: unknown): unknown {
  if (value instanceof Date) return { toDate: () => value }
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value
  if (Array.isArray(value)) return value.map(persist)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, persist(entry)]))
  return value
}

function createRepository(initial: Record<string, Record<string, unknown>> = {}, retryTransaction = false) {
  const documents = new Map(Object.entries(initial))
  const doc = (_db: unknown, ...path: string[]) => path.join('/')
  const runTransaction = async (_db: unknown, callback: (transaction: { get(ref: string): Promise<{ exists(): boolean; data(): Record<string, unknown> }>; set(ref: string, value: Record<string, unknown>, options?: { merge: boolean }): void }) => Promise<unknown>) => {
    const attempt = async (commit: boolean) => {
      const writes = new Map<string, { value: Record<string, unknown>; merge: boolean }>()
      const transaction = {
        get: async (ref: string) => {
          const value = documents.get(ref)
          return { exists: () => value !== undefined, data: () => value ?? {} }
        },
        set: (ref: string, value: Record<string, unknown>, options?: { merge: boolean }) => writes.set(ref, { value, merge: options?.merge ?? false }),
      }
      const result = await callback(transaction)
      if (commit) for (const [ref, write] of writes) {
        const value = persist(write.value) as Record<string, unknown>
        documents.set(ref, write.merge ? { ...documents.get(ref), ...value } : value)
      }
      return result
    }
    if (retryTransaction) await attempt(false)
    return attempt(true)
  }
  const getDoc = async (ref: string) => {
    const value = documents.get(ref)
    return { exists: () => value !== undefined, data: () => value ?? {} }
  }
  const setDoc = async (ref: string, value: Record<string, unknown>) => { documents.set(ref, persist(value) as Record<string, unknown>) }
  const repository = new FirebaseAccountMigrationRepository({ db: {} as never, doc: doc as never, getDoc: getDoc as never, setDoc: setDoc as never, runTransaction: runTransaction as never } as never)
  return { repository, documents }
}

describe('FirebaseAccountMigrationRepository', () => {
  it('adds one new session receipt aggregate and leaves the same receipt untouched on retry', async () => {
    const { repository, documents } = createRepository({ 'users/account-1': { sessionAggregate: { exp: 0, exercisesAttempted: 0, acceptedKeystrokes: 0, rejectedKeystrokes: 0, totalTypingTimeSeconds: 0, bestAccuracy: 0 } } })

    await repository.migrateSessionOutcome('account-1', sessionOutcome)
    await repository.migrateSessionOutcome('account-1', sessionOutcome)

    expect(documents.get('users/account-1')?.sessionAggregate).toMatchObject({ exp: 100, exercisesAttempted: 1 })
    expect([...documents.keys()].filter((path) => path.includes('sessionOutcomes'))).toHaveLength(1)
  })

  it('keeps Cloud profile baseline and display name during the initial merge', async () => {
    const cloud = { ...defaultUserProfile('account-1', new Date('2026-01-02'), 'Cloud'), legacyBaseline: { exp: 10, stats: defaultUserProfile('x', new Date()).stats } }
    const guest = { ...defaultUserProfile('guest-1', new Date('2026-01-01'), 'Guest#0042'), exp: 200 }
    const { repository, documents } = createRepository({ 'users/account-1': persist(cloud) as Record<string, unknown> })

    await repository.mergeInitialState('account-1', 'guest-1', { guestId: 'guest-1', profile: guest, progress: [], reviewItems: [], sessions: [], sessionOutcomes: [] })

    expect(documents.get('users/account-1')?.displayName).toBe('Cloud')
    expect((documents.get('users/account-1')?.legacyBaseline as { exp: number }).exp).toBe(10)
  })

  it('applies one aggregate when Firestore retries the session transaction callback', async () => {
    const { repository, documents } = createRepository({ 'users/account-1': { sessionAggregate: { exp: 0, exercisesAttempted: 0, acceptedKeystrokes: 0, rejectedKeystrokes: 0, totalTypingTimeSeconds: 0, bestAccuracy: 0 } } }, true)

    await repository.migrateSessionOutcome('account-1', sessionOutcome)

    expect(documents.get('users/account-1')?.sessionAggregate).toMatchObject({ exp: 100, exercisesAttempted: 1 })
  })

  it('applies player stats when migrating an outcome, once', async () => {
    const outcomeWithStats: SessionSubmissionOutcome = { ...sessionOutcome, session: { ...sessionOutcome.session, id: 'stats-1', localDate: '2026-10-09', timeZone: 'Asia/Bangkok', typingSeconds: 10, charactersTyped: 1, wordsPracticed: 1, sentencesPracticed: 0, exerciseMistakes: [0], expGained: 25 }, aggregate: { ...sessionOutcome.aggregate, exp: 25 } }
    const { repository, documents } = createRepository()
    await repository.migrateSessionOutcome('account-1', outcomeWithStats)
    await repository.migrateSessionOutcome('account-1', outcomeWithStats)
    expect(documents.get('users/account-1/dailyStats/2026-10-09')).toMatchObject({ expEarned: 25 })
    expect(documents.get('users/account-1')).toMatchObject({ playerStats: { activeDays: 1 } })
  })
})
