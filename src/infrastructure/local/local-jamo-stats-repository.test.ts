import { describe, expect, it } from 'vitest'
import { LocalJamoStatsRepository } from './local-repositories'

describe('LocalJamoStatsRepository', () => {
  it('reads the learnerStats record and returns {} when absent', async () => {
    const records = new Map<string, unknown>([
      ['learnerStats|u1:jamo', { jamo: { ㄱ: { acceptedKeystrokes: 1 } } }],
    ])
    const db = {
      get: async (store: string, key: string) =>
        records.get(`${store}|${key}`) ?? null,
    }
    const repo = new LocalJamoStatsRepository(db as never)
    expect(await repo.getJamoStats('u1')).toEqual({
      ㄱ: { acceptedKeystrokes: 1 },
    })
    expect(await repo.getJamoStats('u2')).toEqual({})
  })
})
