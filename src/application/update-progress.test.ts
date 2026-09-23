import { describe, expect, it } from 'vitest'
import { updateProgress } from './update-progress'
import { FakeProgressRepository } from '../test/fakes'

describe('updateProgress', () => {
  it('creates a fresh progress record on the first attempt', async () => {
    const repo = new FakeProgressRepository()
    const progress = await updateProgress(repo, 'u1', 'l1', {
      accuracy: 80,
      speedWpm: 20,
    })

    expect(progress).toMatchObject({
      lessonId: 'l1',
      status: 'unlocked',
      bestAccuracy: 80,
      bestSpeedWpm: 20,
      attempts: 1,
    })
  })

  it('keeps the best accuracy/speed and increments attempts', async () => {
    const repo = new FakeProgressRepository()
    await updateProgress(repo, 'u1', 'l1', { accuracy: 60, speedWpm: 10 })
    const progress = await updateProgress(repo, 'u1', 'l1', {
      accuracy: 90,
      speedWpm: 5,
    })

    expect(progress.attempts).toBe(2)
    expect(progress.bestAccuracy).toBe(90)
    expect(progress.bestSpeedWpm).toBe(10)
  })

  it('does not overwrite an already-unlocked/completed status', async () => {
    const repo = new FakeProgressRepository()
    await repo.saveProgress('u1', {
      lessonId: 'l1',
      status: 'completed',
      bestAccuracy: 100,
      bestSpeedWpm: 50,
      attempts: 1,
      lastAttemptAt: new Date(),
      completedAt: new Date(),
    })

    const progress = await updateProgress(repo, 'u1', 'l1', {
      accuracy: 70,
      speedWpm: 10,
    })

    expect(progress.status).toBe('completed')
  })
})
