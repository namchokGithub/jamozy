import { describe, expect, it } from 'vitest'
import { StaticHomeContentRepository } from './static-home-content-repository'

const content = {
  schemaVersion: 1,
  exportedAt: '2026-10-06T00:00:00.000Z',
  course: { id: 'home', title: 'Home', description: '' },
  units: [
    {
      id: 'u1',
      title: 'Basics',
      description: '',
      order: 0,
      lessons: [
        {
          id: 'l1',
          title: 'Jamo',
          type: 'character',
          order: 0,
          exercises: [
            {
              id: 'e1',
              targetText: 'ㄱ',
              romanization: 'k',
              meaningTh: '',
              meaningEn: '',
              difficulty: 'easy',
              hint: null,
            },
          ],
        },
      ],
    },
  ],
}

const respond =
  (body: string, status = 200) =>
  async () =>
    new Response(body, { status })

describe('StaticHomeContentRepository', () => {
  it('returns the validated export', async () => {
    const repo = new StaticHomeContentRepository(
      '/content/home.json',
      respond(JSON.stringify(content)),
    )
    expect(await repo.getHomeContent()).toEqual(content)
  })

  it('returns null when the file is missing', async () => {
    const repo = new StaticHomeContentRepository(
      '/content/home.json',
      respond('Not found', 404),
    )
    expect(await repo.getHomeContent()).toBeNull()
  })

  it("returns null for the dev server's HTML fallback", async () => {
    const repo = new StaticHomeContentRepository(
      '/content/home.json',
      respond('<!doctype html><html></html>'),
    )
    expect(await repo.getHomeContent()).toBeNull()
  })

  it('returns null for an export that breaks the schema', async () => {
    const repo = new StaticHomeContentRepository(
      '/content/home.json',
      respond(JSON.stringify({ ...content, schemaVersion: 2 })),
    )
    expect(await repo.getHomeContent()).toBeNull()
  })

  it('returns null when the request fails', async () => {
    const repo = new StaticHomeContentRepository(
      '/content/home.json',
      async () => {
        throw new TypeError('offline')
      },
    )
    expect(await repo.getHomeContent()).toBeNull()
  })
})
