const DB_NAME = 'jamozy-guest'
const VERSION = 1
const stores = ['guestSessions', 'profiles', 'progress', 'reviewItems'] as const
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
}

export const guestDatabase = new GuestDatabase()
