import {
  homeContentSchema,
  type HomeContent,
} from '../../domain/models/home-content'
import type { HomeContentRepository } from '../../domain/repositories/home-content-repository'

declare global {
  interface Window {
    // Started by an inline script in index.html while the app bundle loads.
    __jamozyHomeContent?: Promise<unknown>
  }
}

// Hands over the early request once.
function takeEarlyRequest(): Promise<unknown> | undefined {
  if (typeof window === 'undefined') return undefined
  const early = window.__jamozyHomeContent
  window.__jamozyHomeContent = undefined
  return early
}

// Reads public/content/home.json from the deployed build (DEC-043). A missing
// or unreadable file means "no Home content": Home falls back to the
// Learning Path player instead of failing.
//
// Loaded content is kept for the life of the page: it changes only with a
// deploy, which also needs a page reload for the new app bundle. So route
// revalidations (for example when Firebase Auth reports the user at start)
// never request it again. "No content" is not kept, so a later load can
// recover from a failed request.
export class StaticHomeContentRepository implements HomeContentRepository {
  private loaded: Promise<HomeContent | null> | null = null

  constructor(
    private readonly url = `${import.meta.env.BASE_URL}content/home.json`,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
    private readonly takeEarly: () =>
      Promise<unknown> | undefined = takeEarlyRequest,
  ) {}

  getHomeContent(): Promise<HomeContent | null> {
    if (!this.loaded) {
      const loading = this.load()
      this.loaded = loading
      void loading.then((content) => {
        if (!content && this.loaded === loading) this.loaded = null
      })
    }
    return this.loaded
  }

  private async load(): Promise<HomeContent | null> {
    const early = this.takeEarly()
    const json = early ? await early.catch(() => null) : await this.fetchJson()
    if (json === null) return null
    const parsed = homeContentSchema.safeParse(json)
    if (!parsed.success) {
      if (import.meta.env.DEV)
        console.warn(
          '[home] home.json does not match the schema.',
          parsed.error,
        )
      return null
    }
    return parsed.data
  }

  private async fetchJson(): Promise<unknown> {
    try {
      const response = await this.fetchImpl(this.url)
      if (!response.ok) return null
      // The dev server answers a missing file with index.html, which fails here.
      return await response.json()
    } catch {
      return null
    }
  }
}
