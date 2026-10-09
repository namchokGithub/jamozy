import { describe, expect, it, vi } from 'vitest'
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

  describe('early request started by index.html', () => {
    it('uses the early request instead of fetching again', async () => {
      const fetchImpl = vi.fn(respond(JSON.stringify(content)))
      const repo = new StaticHomeContentRepository(
        '/content/home.json',
        fetchImpl,
        () => Promise.resolve(content),
      )

      expect(await repo.getHomeContent()).toEqual(content)
      expect(fetchImpl).not.toHaveBeenCalled()
    })

    it('reuses loaded content for later loads, such as revalidations', async () => {
      const fetchImpl = vi.fn(respond(JSON.stringify(content)))
      const repo = new StaticHomeContentRepository(
        '/content/home.json',
        fetchImpl,
        () => undefined,
      )

      expect(await repo.getHomeContent()).toEqual(content)
      expect(await repo.getHomeContent()).toEqual(content)

      expect(fetchImpl).toHaveBeenCalledOnce()
    })

    it('tries again after a load found no content', async () => {
      const fetchImpl = vi.fn(respond(JSON.stringify(content)))
      let early: Promise<unknown> | undefined = Promise.resolve(null)
      const repo = new StaticHomeContentRepository(
        '/content/home.json',
        fetchImpl,
        () => {
          const taken = early
          early = undefined
          return taken
        },
      )

      expect(await repo.getHomeContent()).toBeNull()
      expect(await repo.getHomeContent()).toEqual(content)
      expect(fetchImpl).toHaveBeenCalledOnce()
    })

    it('returns null without fetching when the early request found no content', async () => {
      const fetchImpl = vi.fn(respond(JSON.stringify(content)))
      const repo = new StaticHomeContentRepository(
        '/content/home.json',
        fetchImpl,
        () => Promise.resolve(null),
      )

      expect(await repo.getHomeContent()).toBeNull()
      expect(fetchImpl).not.toHaveBeenCalled()
    })

    it('validates early content against the schema', async () => {
      const repo = new StaticHomeContentRepository(
        '/content/home.json',
        respond('{}'),
        () => Promise.resolve({ ...content, schemaVersion: 2 }),
      )

      expect(await repo.getHomeContent()).toBeNull()
    })
  })
})
