import type { HomeContent } from '../models/home-content'

export interface HomeContentRepository {
  /** The static Home export, or null when none is deployed (DEC-043). */
  getHomeContent(): Promise<HomeContent | null>
}
