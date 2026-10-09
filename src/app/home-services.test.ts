import { describe, expect, it, vi } from 'vitest'
import { createHomeServices } from './home-services'
import type { HomeOutbox } from '../application/home-outbox'

describe('createHomeServices', () => {
  it('queues Home writes for the active user without blocking the caller', async () => {
    const outbox = {
      enqueueExercise: vi.fn(async () => {}),
      enqueueReplay: vi.fn(async () => {}),
    }
    const localState = { saveResume: vi.fn(async () => {}) }
    const services = createHomeServices({
      outbox: outbox as unknown as HomeOutbox,
      localState: localState as never,
      getActiveUser: async () => ({ uid: 'u1' }),
    })
    const lesson = {
      id: 'l1',
      title: 'L',
      type: 'character' as const,
      order: 0,
      exercises: [
        {
          id: 'e1',
          targetText: 'ㄱ',
          romanization: null,
          meaningTh: '',
          meaningEn: '',
          difficulty: 'easy' as const,
          hint: null,
        },
      ],
    }
    const result = {
      exerciseId: 'e1',
      targetText: 'ㄱ',
      correctKeyCount: 1,
      mistakes: [],
    }

    expect(services.recordExercise({ lesson, result })).toBeUndefined()
    services.recordReplay({
      lessonId: 'l1',
      totals: {
        startedAtMs: 0,
        durationSeconds: 1,
        exercisesAttempted: 1,
        acceptedKeystrokes: 1,
        rejectedKeystrokes: 0,
      },
    })
    services.saveResume({ unitId: 'u1', lessonId: 'l1' })

    await vi.waitFor(() =>
      expect(localState.saveResume).toHaveBeenCalledWith('u1', {
        unitId: 'u1',
        lessonId: 'l1',
      }),
    )
    expect(outbox.enqueueExercise).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        lesson: expect.objectContaining({
          id: 'l1',
          type: 'character',
          exercises: [{ id: 'e1' }],
        }),
        result,
      }),
    )
    expect(outbox.enqueueReplay).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', lessonId: 'l1' }),
    )
  })

  it('swallows a failed background write', async () => {
    const services = createHomeServices({
      outbox: {} as HomeOutbox,
      localState: {
        saveResume: async () => {
          throw new Error('quota')
        },
      } as never,
      getActiveUser: async () => ({ uid: 'u1' }),
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(() =>
      services.saveResume({ unitId: 'u1', lessonId: 'l1' }),
    ).not.toThrow()
    await vi.waitFor(() => expect(warn).toHaveBeenCalled())
    warn.mockRestore()
  })
})
