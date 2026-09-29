import { describe, expect, it } from 'vitest'
import {
  migrateContentStatus,
  parseMigrationArgs,
} from './migrate-content-status'

function fakeDb() {
  const collections: Record<string, Array<Record<string, unknown>>> = {
    courses: [{ title: 'legacy' }, { status: 'draft' }],
    units: [{ courseId: 'course' }],
    lessons: [{ unitId: 'unit' }],
    users: [{ ignored: true }],
  }
  let writes = 0
  const db = {
    collection(name: string) {
      return {
        async get() {
          return {
            docs: (collections[name] ?? []).map((data) => ({
              data: () => data,
              ref: {
                async update(next: Record<string, unknown>) {
                  Object.assign(data, next)
                  writes += 1
                },
              },
            })),
          }
        },
      }
    },
  }
  return {
    db,
    collections,
    writes: () => writes,
  }
}

describe('migrateContentStatus', () => {
  it('accepts pnpm forwarded dry-run arguments', () => {
    expect(parseMigrationArgs(['--', '--dry-run'])).toEqual({
      mode: '--dry-run',
      confirmedAfterDryRun: false,
    })
  })

  it('only marks statusless content published and remains idempotent', async () => {
    const fake = fakeDb()
    await expect(migrateContentStatus(fake.db, true)).resolves.toEqual({
      scanned: 4,
      updated: 3,
      dryRun: true,
    })
    expect(fake.writes()).toBe(0)
    await expect(migrateContentStatus(fake.db, false)).resolves.toEqual({
      scanned: 4,
      updated: 3,
      dryRun: false,
    })
    await expect(migrateContentStatus(fake.db, false)).resolves.toEqual({
      scanned: 4,
      updated: 0,
      dryRun: false,
    })
    expect(fake.collections.users[0]).toEqual({ ignored: true })
  })
})
