import { describe, expect, it } from 'vitest'
import { LocalProgressRepository, LocalReviewRepository, LocalUserProfileRepository } from './local-repositories'
import type { Progress } from '../../domain/models/progress'

class MemoryDatabase {
  private values = new Map<string, unknown>()
  async get<T>(_store: string, key: string) { return (this.values.get(key) as T | undefined) ?? null }
  async getAll<T>(_store: string, prefix: string) { return [...this.values.entries()].filter(([key]) => key.startsWith(prefix)).map(([, value]) => value as T) }
  async put<T>(_store: string, key: string, value: T) { this.values.set(key, value) }
}

describe('local learner repositories', () => {
  it('keeps progress isolated by Guest ID', async () => {
    const repo = new LocalProgressRepository(new MemoryDatabase() as never)
    const progress: Progress = { lessonId: 'lesson-1', status: 'completed', bestAccuracy: 100, bestSpeedWpm: 20, attempts: 1, lastAttemptAt: null, completedAt: new Date('2026-01-01') }
    await repo.saveProgress('guest-a', progress)
    expect(await repo.getProgress('guest-a', 'lesson-1')).toEqual(progress)
    expect(await repo.getProgress('guest-b', 'lesson-1')).toBeNull()
  })

  it('keeps profile and review storage independent', async () => {
    const database = new MemoryDatabase() as never
    const profiles = new LocalUserProfileRepository(database)
    const reviews = new LocalReviewRepository(database)
    await profiles.saveUserProfile('guest-a', { id: 'guest-a', displayName: 'Guest#0042', exp: 0, settings: { soundEnabled: true, showKeyboard: true, showEnglishKeys: true, keyboardOpacity: 0.7, romanizationEnabled: true, meaningLanguage: 'both', theme: 'light' }, stats: { lessonsCompleted: 0, wordsPracticed: 0, averageAccuracy: 0, bestAccuracy: 0, averageSpeedWpm: 0, totalTypingTimeSeconds: 0 }, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') })
    await reviews.addReviewItem('guest-a', { id: 'word', sourceLessonId: 'l', sourceExerciseId: 'e', targetText: '가', reason: 'mistake', mistakeCount: 1, lastMistakeAt: new Date(), resolved: false, box: 1, nextReviewAt: new Date() })
    expect((await profiles.getUserProfile('guest-a'))?.displayName).toBe('Guest#0042')
    expect(await reviews.getReviewItems('guest-b')).toEqual([])
  })
})
