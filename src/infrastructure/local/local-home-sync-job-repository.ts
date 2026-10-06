import type { HomeSyncJob } from '../../domain/models/home-sync-job'
import type { HomeSyncJobRepository } from '../../domain/repositories/home-sync-job-repository'
import { guestDatabase, type GuestDatabase } from './guest-database'

// Keyed by enqueue time, then id, so the store's natural order is oldest
// first. Holds jobs for Guests and signed-in learners alike (DEC-043).
function key(job: HomeSyncJob): string {
  return `${String(job.enqueuedAt.getTime()).padStart(15, '0')}:${job.id}`
}

export class LocalHomeSyncJobRepository implements HomeSyncJobRepository {
  constructor(private readonly db: GuestDatabase = guestDatabase) {}

  async list(): Promise<HomeSyncJob[]> {
    const jobs = await this.db.getAll<HomeSyncJob>('homeSyncJobs', '')
    return jobs.sort((left, right) => key(left).localeCompare(key(right)))
  }

  async save(job: HomeSyncJob): Promise<void> {
    await this.db.put('homeSyncJobs', key(job), job)
  }

  async remove(job: HomeSyncJob): Promise<void> {
    await this.db.delete('homeSyncJobs', key(job))
  }
}
