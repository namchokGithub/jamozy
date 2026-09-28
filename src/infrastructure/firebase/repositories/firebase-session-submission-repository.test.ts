import { describe, expect, it } from 'vitest'
import type { LearningSession } from '../../../domain/models/learning-session'
import type { SessionSubmissionEffects } from '../../../domain/repositories/session-submission-repository'
import { FirebaseSessionSubmissionRepository } from './firebase-session-submission-repository'

const session: LearningSession = {
  id: 'session-1',
  context: { mode: 'learning-path', lessonId: 'lesson-1' },
  startedAt: new Date('2026-01-01T00:00:00.000Z'),
  completedAt: new Date('2026-01-01T00:01:00.000Z'),
  durationSeconds: 60,
  exercisesAttempted: 1,
  acceptedKeystrokes: 10,
  rejectedKeystrokes: 0,
  expGained: 100,
}

const effects: SessionSubmissionEffects = {
  progress: [{ lessonId: 'lesson-1', status: 'completed', bestAccuracy: 100, bestSpeedWpm: 12, attempts: 1, lastAttemptAt: session.completedAt, completedAt: session.completedAt }],
  reviewItems: [{ id: 'exercise-1', sourceLessonId: 'lesson-1', sourceExerciseId: 'exercise-1', targetText: '가', reason: 'mistake', mistakeCount: 1, lastMistakeAt: session.completedAt, resolved: false, box: 1, nextReviewAt: new Date('2026-01-02') }],
}

function persisted(value: unknown): unknown {
  if (value instanceof Date) return { toDate: () => value }
  if (Array.isArray(value)) return value.map(persisted)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, persisted(entry)]))
  return value
}

function createRepository(retryTransaction = false) {
  const documents = new Map<string, Record<string, unknown>>([
    ['users/user-1', { exp: 40, stats: { lessonsCompleted: 1 } }],
  ])
  const doc = (_db: unknown, ...path: string[]) => path.join('/')
  const execute = async (callback: (transaction: { get(ref: string): Promise<{ exists(): boolean; data(): Record<string, unknown> }>; set(ref: string, value: Record<string, unknown>, options?: { merge: boolean }): void }) => Promise<unknown>) => {
    const attempt = async (commit: boolean) => {
      const writes = new Map<string, { value: Record<string, unknown>; merge: boolean }>()
      const transaction = {
        get: async (ref: string) => {
          const value = documents.get(ref)
          return { exists: () => value !== undefined, data: () => value ?? {} }
        },
        set: (ref: string, value: Record<string, unknown>, options?: { merge: boolean }) => writes.set(ref, { value, merge: options?.merge ?? false }),
      }
      const outcome = await callback(transaction)
      if (commit) {
        for (const [ref, write] of writes) {
          const value = persisted(write.value) as Record<string, unknown>
          documents.set(ref, write.merge ? { ...documents.get(ref), ...value } : value)
        }
      }
      return outcome
    }
    if (retryTransaction) await attempt(false)
    return attempt(true)
  }
  const repository = new FirebaseSessionSubmissionRepository({ db: {} as never, doc: doc as never, runTransaction: ((_db: unknown, callback: never) => execute(callback as never)) as never })
  return { repository, documents }
}

describe('FirebaseSessionSubmissionRepository', () => {
  it('returns the stored receipt and writes review effects only once for the same session ID', async () => {
    const { repository, documents } = createRepository()

    const initial = await repository.submit('user-1', session, effects)
    const retry = await repository.submit('user-1', session, effects)

    expect(initial.wasDuplicate).toBe(false)
    expect(retry.wasDuplicate).toBe(true)
    expect([...documents.keys()].filter((path) => path.includes('/reviewItems/'))).toEqual(['users/user-1/reviewItems/exercise-1'])
  })

  it('applies the aggregate once when Firestore retries a transaction callback', async () => {
    const { repository, documents } = createRepository(true)

    await repository.submit('user-1', session, effects)

    expect(documents.get('users/user-1')?.sessionAggregate).toMatchObject({ exp: 100, exercisesAttempted: 1 })
    expect([...documents.keys()].filter((path) => path.includes('/reviewItems/'))).toHaveLength(1)
  })
})
