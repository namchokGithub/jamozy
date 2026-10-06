import type { HomeLessonRef } from '../home/home-session'
import type { Progress } from '../models/progress'

// Device-local Home state (DEC-043): the last known Progress of Home lessons,
// shown before the live Progress arrives, and the resume pointer.
export interface HomeLocalStateRepository {
  getCachedProgress(userId: string): Promise<Progress[]>
  saveCachedProgress(userId: string, progress: Progress[]): Promise<void>
  getResume(userId: string): Promise<HomeLessonRef | null>
  saveResume(userId: string, resume: HomeLessonRef): Promise<void>
}
