import { create } from 'zustand'
import {
  pressKey as pressKeyReducer,
  startLessonSession,
  type LessonSessionState,
} from '../../domain/korean/lesson-session'
import type { LessonExercise } from '../../domain/models/lesson'

interface LessonSessionStore {
  session: LessonSessionState | null
  // Incremented on every start() call, and never touched by pressKey().
  // This store is a module-level singleton shared across every mounted
  // LessonTypingSession, so a consumer that captures the generation number
  // start() returns can tell "my own lesson's session" apart from a
  // previous lesson's leftover session still sitting in the store.
  generation: number
  start: (exercises: Array<Pick<LessonExercise, 'id' | 'targetText'>>) => number
  pressKey: (code: string, shiftKey: boolean) => void
}

export const useLessonSessionStore = create<LessonSessionStore>((set, get) => ({
  session: null,
  generation: 0,
  start: (exercises) => {
    const generation = get().generation + 1
    set({ session: startLessonSession(exercises), generation })
    return generation
  },
  pressKey: (code, shiftKey) => {
    const { session } = get()
    if (!session) return
    set({ session: pressKeyReducer(session, code, shiftKey) })
  },
}))
