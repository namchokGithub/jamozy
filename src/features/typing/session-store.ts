import { create } from 'zustand'
import {
  pressKey as pressKeyReducer,
  startTypingSession,
  type TypingSessionState,
} from '../../domain/korean/typing-session'

interface TypingSessionStore {
  session: TypingSessionState | null
  start: (targetText: string) => void
  pressKey: (code: string, shiftKey: boolean) => void
}

export const useTypingSessionStore = create<TypingSessionStore>((set, get) => ({
  session: null,
  start: (targetText) => set({ session: startTypingSession(targetText) }),
  pressKey: (code, shiftKey) => {
    const { session } = get()
    if (!session) return
    set({ session: pressKeyReducer(session, code, shiftKey) })
  },
}))
