import { describe, expect, it } from 'vitest'
import { getWeakJamoPractice, getWeakJamoSummary } from './get-weak-jamo-practice'
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
