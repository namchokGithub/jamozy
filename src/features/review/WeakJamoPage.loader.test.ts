import { describe, expect, it } from 'vitest'
import { createWeakJamoLoader } from './WeakJamoPage.loader'
import { FakeJamoStatsRepository, FakeUserProfileRepository } from '../../test/fakes'
import { homeContentWith } from '../../test/home-content-fixture'

const weakStats = {
  ㅓ: { acceptedKeystrokes: 80, rejectedKeystrokes: 20, firstPracticedAt: new Date(0), lastPracticedAt: new Date(0) },
}
const request = (search = '') =>
  ({ request: new Request(`http://localhost/review/weak-jamo${search}`) }) as never
const loader = (targets: string[]) =>
  createWeakJamoLoader({
    jamoStatsRepo: new FakeJamoStatsRepository({ u1: weakStats }),
    contentRepo: { getHomeContent: async () => homeContentWith(targets) },
    userProfileRepo: new FakeUserProfileRepository(),
    ensureUser: async () => ({ uid: 'u1' }),
  })

describe('createWeakJamoLoader', () => {
  it('returns targets, exercises, and settings', async () => {
    const data = await loader(['어'])(request())
    expect(data.targets[0].jamo).toBe('ㅓ')
    expect(data.exercises).toHaveLength(1)
    expect(data.settings).toHaveProperty('showKeyboard')
  })

  it('redirects to /review when there is nothing to practice', async () => {
    const response = await loader(['가'])(request()).catch((thrown: unknown) => thrown)
    expect(response).toBeInstanceOf(Response)
    expect((response as Response).status).toBe(302)
    expect((response as Response).headers.get('Location')).toBe('/review')
  })

  it('drills a jamo chosen in the URL, and redirects when it cannot', async () => {
    const data = await loader(['어', '가'])(request('?jamo=%E3%85%93'))
    expect(data.targets.map((target) => target.jamo)).toEqual(['ㅓ'])
    const response = await loader(['어'])(request('?jamo=%E3%84%B1')).catch((thrown: unknown) => thrown)
    expect((response as Response).headers.get('Location')).toBe('/review')
  })
})

