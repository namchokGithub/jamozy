import { describe, expect, it } from 'vitest'
import { useLessonSessionStore } from './lesson-session-store'

describe('useLessonSessionStore', () => {
  it('starts a lesson session and applies pressKey to it', () => {
    useLessonSessionStore.getState().start([{ id: 'e1', targetText: '가' }])
    expect(useLessonSessionStore.getState().session?.status).toBe('typing')

    useLessonSessionStore.getState().pressKey('KeyR', false)
    expect(useLessonSessionStore.getState().session?.currentSession.keyIndex).toBe(1)
  })

  it('ignores pressKey when no session has been started', () => {
    useLessonSessionStore.setState({ session: null })
    useLessonSessionStore.getState().pressKey('KeyR', false)
    expect(useLessonSessionStore.getState().session).toBeNull()
  })

  it('returns a fresh, increasing generation on every start() call, unaffected by pressKey', () => {
    useLessonSessionStore.setState({ session: null, generation: 0 })

    const gen1 = useLessonSessionStore.getState().start([{ id: 'e1', targetText: '가' }])
    expect(gen1).toBe(1)
    expect(useLessonSessionStore.getState().generation).toBe(1)

    useLessonSessionStore.getState().pressKey('KeyR', false)
    expect(useLessonSessionStore.getState().generation).toBe(1)

    const gen2 = useLessonSessionStore.getState().start([{ id: 'e2', targetText: '나' }])
    expect(gen2).toBe(2)
    expect(useLessonSessionStore.getState().generation).toBe(2)
  })
})
