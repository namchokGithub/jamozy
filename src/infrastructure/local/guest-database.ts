import { addSessionAggregate, emptySessionAggregate, type SessionAggregate } from '../../domain/models/session-aggregate'
import type { UserProfile } from '../../domain/models/user-profile'

const DB_NAME = 'jamozy-guest'
const VERSION = 3
const stores = ['guestSessions', 'profiles', 'progress', 'reviewItems', 'learningSessions', 'sessionOutcomes', 'migrationCheckpoints'] as const
type StoreName = (typeof stores)[number]

export class GuestDatabase {
  private database?: Promise<IDBDatabase>

  private open(): Promise<IDBDatabase> {
    if (this.database) return this.database
    this.database = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, VERSION)
      request.onupgradeneeded = () => {
        for (const store of stores) if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return this.database
  }

  async get<T>(store: StoreName, key: string): Promise<T | null> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const request = db.transaction(store).objectStore(store).get(key)
      request.onsuccess = () => resolve((request.result as T | undefined) ?? null)
      request.onerror = () => reject(request.error)
    })
  }

  async getAll<T>(store: StoreName, prefix: string): Promise<T[]> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const values: T[] = []
      const request = db.transaction(store).objectStore(store).openCursor()
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) return resolve(values)
        if (String(cursor.key).startsWith(prefix)) values.push(cursor.value as T)
        cursor.continue()
      }
      request.onerror = () => reject(request.error)
    })
  }

  async put<T>(store: StoreName, key: string, value: T): Promise<void> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const request = db.transaction(store, 'readwrite').objectStore(store).put(value, key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async putSessionOnce<T extends { aggregate: SessionAggregate }>(
    key: string,
    session: unknown,
    outcome: T,
    effects: { progress: Array<{ lessonId: string }>; reviewItems: Array<{ id: string }> },
  ): Promise<{ outcome: T; inserted: boolean }> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['profiles', 'learningSessions', 'sessionOutcomes', 'progress', 'reviewItems'], 'readwrite')
      let inserted = false
      let existingOutcome: T | null = null
      const receipt = transaction.objectStore('sessionOutcomes').get(key)
      receipt.onsuccess = () => {
        if (receipt.result) {
          existingOutcome = receipt.result as T
          return
        }
        const userId = key.slice(0, key.lastIndexOf(':'))
        const profile = transaction.objectStore('profiles').get(`${userId}:`)
        profile.onsuccess = () => {
          inserted = true
          transaction.objectStore('learningSessions').put(session, key)
          transaction.objectStore('sessionOutcomes').put(outcome, key)
          const currentProfile = profile.result as UserProfile | undefined
          if (currentProfile) {
            transaction.objectStore('profiles').put({
              ...currentProfile,
              legacyBaseline: currentProfile.legacyBaseline ?? { exp: currentProfile.exp, stats: currentProfile.stats },
              sessionAggregate: addSessionAggregate(currentProfile.sessionAggregate ?? emptySessionAggregate(), outcome.aggregate),
              updatedAt: new Date(),
            }, `${userId}:`)
          }
          for (const progress of effects.progress) {
            transaction.objectStore('progress').put(progress, `${userId}:${progress.lessonId}`)
          }
          for (const reviewItem of effects.reviewItems) {
            transaction.objectStore('reviewItems').put(reviewItem, `${userId}:${reviewItem.id}`)
          }
        }
        profile.onerror = () => reject(profile.error)
      }
      receipt.onerror = () => reject(receipt.error)
      transaction.oncomplete = () => resolve({ outcome: existingOutcome ?? outcome, inserted })
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  }
}

export const guestDatabase = new GuestDatabase()
