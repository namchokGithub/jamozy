import { describe, expect, it } from 'vitest'
import { useTypingSessionStore } from './session-store'

describe('useTypingSessionStore', () => {
  it('starts a session and applies pressKey to it', () => {
    useTypingSessionStore.getState().start('가')
    expect(useTypingSessionStore.getState().session?.targetText).toBe('가')
    expect(useTypingSessionStore.getState().session?.keyIndex).toBe(0)

    useTypingSessionStore.getState().pressKey('KeyR', false)
    expect(useTypingSessionStore.getState().session?.keyIndex).toBe(1)
  })

  it('ignores pressKey when no session has been started', () => {
    useTypingSessionStore.setState({ session: null })
    useTypingSessionStore.getState().pressKey('KeyR', false)
    expect(useTypingSessionStore.getState().session).toBeNull()
  })
})
