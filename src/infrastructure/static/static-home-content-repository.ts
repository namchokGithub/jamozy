import {
  homeContentSchema,
  type HomeContent,
} from '../../domain/models/home-content'
import type { HomeContentRepository } from '../../domain/repositories/home-content-repository'

// Reads public/content/home.json from the deployed build (DEC-043). A missing
// or unreadable file means "no Home content": Home falls back to the
// Learning Path player instead of failing.
export class StaticHomeContentRepository implements HomeContentRepository {
  constructor(
    private readonly url = `${import.meta.env.BASE_URL}content/home.json`,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  async getHomeContent(): Promise<HomeContent | null> {
    try {
      const response = await this.fetchImpl(this.url)
      if (!response.ok) return null
      // The dev server answers a missing file with index.html.
      const parsed = homeContentSchema.safeParse(await response.json())
      if (!parsed.success) {
        if (import.meta.env.DEV)
          console.warn(
            '[home] home.json does not match the schema.',
            parsed.error,
          )
        return null
      }
      return parsed.data
    } catch {
      return null
    }
  }
}
