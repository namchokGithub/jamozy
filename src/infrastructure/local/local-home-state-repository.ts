import type { HomeLessonRef } from '../../domain/home/home-session'
import type { Progress } from '../../domain/models/progress'
import type { HomeLocalStateRepository } from '../../domain/repositories/home-local-state-repository'
import { guestDatabase, type GuestDatabase } from './guest-database'

export class LocalHomeStateRepository implements HomeLocalStateRepository {
  constructor(private readonly db: GuestDatabase = guestDatabase) {}

  async getCachedProgress(userId: string): Promise<Progress[]> {
    return (await this.db.get<Progress[]>('homeProgressCache', userId)) ?? []
  }

  async saveCachedProgress(
    userId: string,
    progress: Progress[],
  ): Promise<void> {
    await this.db.put('homeProgressCache', userId, progress)
  }

  async getResume(userId: string): Promise<HomeLessonRef | null> {
    return this.db.get<HomeLessonRef>('homeResume', userId)
  }

  async saveResume(userId: string, resume: HomeLessonRef): Promise<void> {
    await this.db.put('homeResume', userId, resume)
  }
}
