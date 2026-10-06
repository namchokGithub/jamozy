import { describe, expect, it } from 'vitest'
import { getHomePlayer, refreshHomeProgress } from './get-home-player'
import { FakeProgressRepository } from '../test/fakes'
import type { HomeContent } from '../domain/models/home-content'
import type { Progress } from '../domain/models/progress'
import type { HomeLocalStateRepository } from '../domain/repositories/home-local-state-repository'

const content: HomeContent = {
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

const progress = (
  lessonId: string,
  overrides: Partial<Progress> = {},
): Progress => ({
  lessonId,
  status: 'unlocked',
  bestAccuracy: 0,
  bestSpeedWpm: 0,
  attempts: 0,
  lastAttemptAt: null,
  completedAt: null,
  ...overrides,
})

class MemoryLocalState implements HomeLocalStateRepository {
  cached = new Map<string, Progress[]>()
  resume = new Map<string, { unitId: string; lessonId: string }>()
  async getCachedProgress(userId: string) {
    return this.cached.get(userId) ?? []
  }
  async saveCachedProgress(userId: string, value: Progress[]) {
    this.cached.set(userId, value)
  }
  async getResume(userId: string) {
    return this.resume.get(userId) ?? null
  }
  async saveResume(
    userId: string,
    value: { unitId: string; lessonId: string },
  ) {
    this.resume.set(userId, value)
  }
}

describe('getHomePlayer', () => {
  it('combines the static content with local cache, resume, and pending exercises', async () => {
    const localState = new MemoryLocalState()
    localState.cached.set('u1', [
      progress('l1', { completedExerciseIds: ['e1'] }),
    ])
    localState.resume.set('u1', { unitId: 'u1', lessonId: 'l1' })

    const player = await getHomePlayer(
      {
        contentRepo: { getHomeContent: async () => content },
        localState,
        pendingExerciseIds: async () => new Map([['l1', new Set(['e2'])]]),
      },
      'u1',
    )

    expect(player).toEqual({
      content,
      progress: [progress('l1', { completedExerciseIds: ['e1'] })],
      pendingExerciseIds: { l1: ['e2'] },
      resume: { unitId: 'u1', lessonId: 'l1' },
    })
  })

  it('returns null without Home content', async () => {
    const player = await getHomePlayer(
      {
        contentRepo: { getHomeContent: async () => null },
        localState: new MemoryLocalState(),
        pendingExerciseIds: async () => new Map(),
      },
      'u1',
    )

    expect(player).toBeNull()
  })
})

describe('refreshHomeProgress', () => {
  it('reads live Progress for Home lessons only and caches it', async () => {
    const progressRepo = new FakeProgressRepository()
    await progressRepo.saveProgress(
      'u1',
      progress('l1', { status: 'completed' }),
    )
    await progressRepo.saveProgress('u1', progress('learning-path-lesson'))
    const localState = new MemoryLocalState()

    const live = await refreshHomeProgress(
      { progressRepo, localState },
      'u1',
      content,
    )

    expect(live).toEqual([progress('l1', { status: 'completed' })])
    expect(await localState.getCachedProgress('u1')).toEqual(live)
  })
})
