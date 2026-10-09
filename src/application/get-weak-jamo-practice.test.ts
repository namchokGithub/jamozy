import { describe, expect, it } from 'vitest'
import { getJamoOverview, getWeakJamoPractice, getWeakJamoSummary } from './get-weak-jamo-practice'
import { FakeJamoStatsRepository } from '../test/fakes'
import { homeContentWith } from '../test/home-content-fixture'
import type { HomeContentRepository } from '../domain/repositories/home-content-repository'

const weakStats = {
  ㅓ: { acceptedKeystrokes: 80, rejectedKeystrokes: 20, firstPracticedAt: new Date(0), lastPracticedAt: new Date(0) },
}
const content = (targets: string[]): HomeContentRepository => ({
  getHomeContent: async () => homeContentWith(targets),
})
const deps = (contentRepo: HomeContentRepository) => ({
  jamoStatsRepo: new FakeJamoStatsRepository({ u1: weakStats }),
  contentRepo,
})

describe('getWeakJamoSummary', () => {
  it('summarizes targets and available exercises', async () => {
    expect(await getWeakJamoSummary(deps(content(['어', '가'])), 'u1')).toEqual({
      targets: [{ jamo: 'ㅓ', mistakeRate: 0.2, attempts: 100 }],
      available: 1,
    })
  })

  it('returns null when content is missing or fails to load', async () => {
    expect(await getWeakJamoSummary(deps({ getHomeContent: async () => null }), 'u1')).toBeNull()
    expect(
      await getWeakJamoSummary(deps({ getHomeContent: async () => { throw new Error('404') } }), 'u1'),
    ).toBeNull()
  })

  it('returns null without enough practiced jamo or a matching exercise', async () => {
    expect(
      await getWeakJamoSummary({ jamoStatsRepo: new FakeJamoStatsRepository(), contentRepo: content(['어']) }, 'u1'),
    ).toBeNull()
    expect(await getWeakJamoSummary(deps(content(['가'])), 'u1')).toBeNull()
  })
})

describe('getWeakJamoPractice', () => {
  it('returns targets and selected exercises, or null when nothing matches', async () => {
    const practice = await getWeakJamoPractice(deps(content(['어', '거', '가'])), 'u1', () => 0)
    expect(practice?.targets.map((target) => target.jamo)).toEqual(['ㅓ'])
    expect(practice?.exercises.map((exercise) => exercise.targetText).sort()).toEqual(['거', '어'])
    expect(await getWeakJamoPractice(deps(content(['가'])), 'u1')).toBeNull()
  })
})

describe('getJamoOverview', () => {
  it('returns stats, the weak jamo summary, and the jamo Home can drill', async () => {
    const overview = await getJamoOverview(deps(content(['어', '가'])), 'u1')
    expect(overview?.stats).toBe(weakStats)
    expect(overview?.weakJamo?.targets[0].jamo).toBe('ㅓ')
    expect(overview?.practicable.sort()).toEqual(['ㄱ', 'ㅇ', 'ㅏ', 'ㅓ'])
  })

  it('keeps stats when Home content fails, and is null when stats fail', async () => {
    const overview = await getJamoOverview(
      deps({ getHomeContent: async () => { throw new Error('404') } }),
      'u1',
    )
    expect(overview).toEqual({ stats: weakStats, weakJamo: null, practicable: [] })
    expect(
      await getJamoOverview(
        { jamoStatsRepo: { getJamoStats: async () => { throw new Error('offline') } }, contentRepo: content(['어']) },
        'u1',
      ),
    ).toBeNull()
  })
})

describe('getWeakJamoPractice with a chosen jamo', () => {
  const stats = {
    ...weakStats,
    ㄱ: { acceptedKeystrokes: 15, rejectedKeystrokes: 5, firstPracticedAt: new Date(0), lastPracticedAt: new Date(0) },
  }
  const focusDeps = (targets: string[]) => ({
    jamoStatsRepo: new FakeJamoStatsRepository({ u1: stats }),
    contentRepo: content(targets),
  })

  it('drills only the chosen jamo', async () => {
    const practice = await getWeakJamoPractice(focusDeps(['어', '가']), 'u1', () => 0, 'ㄱ')
    expect(practice?.targets).toEqual([{ jamo: 'ㄱ', mistakeRate: 0.25, attempts: 20 }])
    expect(practice?.exercises.map((exercise) => exercise.targetText)).toEqual(['가'])
  })

  it('returns null for a jamo that is unranked, unknown, or not in any exercise', async () => {
    expect(await getWeakJamoPractice(focusDeps(['가']), 'u1', () => 0, 'ㄴ')).toBeNull()
    expect(await getWeakJamoPractice(focusDeps(['가']), 'u1', () => 0, 'x')).toBeNull()
    expect(await getWeakJamoPractice(focusDeps(['어']), 'u1', () => 0, 'ㄱ')).toBeNull()
  })
})

