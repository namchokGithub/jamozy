import type { HomeSyncJob } from '../models/home-sync-job'

export interface HomeSyncJobRepository {
  /** Oldest first. */
  list(): Promise<HomeSyncJob[]>
  /** Adds or replaces a job. */
  save(job: HomeSyncJob): Promise<void>
  remove(job: HomeSyncJob): Promise<void>
}
