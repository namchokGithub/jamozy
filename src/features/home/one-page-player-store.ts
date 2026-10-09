import { create } from 'zustand'
import type { OnePageQueueExercise } from '../../application/get-one-page-learning-path'
import {
  appendExercises,
  compactLessonSession,
  pressKey as pressKeyReducer,
  startLessonSession,
  type ExerciseResult,
  type LessonSessionState,
} from '../../domain/korean/lesson-session'

export interface CompletedOnePageExercise {
  entry: OnePageQueueExercise
  result: ExerciseResult
}

// The Home player's transient play queue (DEC-042). `entries` stays aligned
// with `session.exercises`: both are compacted after every completed
// exercise, so index 0 is always the current word.
interface OnePagePlayerStore {
  entries: OnePageQueueExercise[]
  session: LessonSessionState | null
  completedCount: number
  // No further words: the initial queue was empty or a refill came back empty.
  exhausted: boolean
  acceptedKeystrokes: number
  rejectedKeystrokes: number
  start: (entries: OnePageQueueExercise[]) => void
  append: (entries: OnePageQueueExercise[]) => void
  // Returns the exercise this key press completed, if any.
  pressKey: (code: string, shiftKey: boolean) => CompletedOnePageExercise | null
}

const toExercises = (entries: OnePageQueueExercise[]) =>
  entries.map(({ exercise }) => ({ id: exercise.id, targetText: exercise.targetText }))

export const useOnePagePlayerStore = create<OnePagePlayerStore>((set, get) => ({
  entries: [],
  session: null,
  completedCount: 0,
  exhausted: false,
  acceptedKeystrokes: 0,
  rejectedKeystrokes: 0,
  start: (entries) => {
    set({
      entries,
      session: startLessonSession(toExercises(entries)),
      completedCount: 0,
      exhausted: entries.length === 0,
      acceptedKeystrokes: 0,
      rejectedKeystrokes: 0,
    })
  },
  append: (entries) => {
    const { session, entries: current } = get()
    if (!session) return
    if (entries.length === 0) {
      set({ exhausted: true })
      return
    }
    const appended = appendExercises(session, toExercises(entries))
    const compacted = compactLessonSession(appended)
    set({
      entries: [...current, ...entries].slice(appended.currentIndex),
      session: compacted,
    })
  },
  pressKey: (code, shiftKey) => {
    const state = get()
    if (!state.session) return null
    const next = pressKeyReducer(state.session, code, shiftKey, Date.now())
    const result = next.lastCompletedExercise
    if (!result) {
      set({ session: next })
      return null
    }
    const entry = state.entries[state.session.currentIndex]
    set({
      entries: state.entries.slice(next.currentIndex),
      session: compactLessonSession(next),
      completedCount: state.completedCount + 1,
      acceptedKeystrokes: state.acceptedKeystrokes + result.correctKeyCount,
      rejectedKeystrokes: state.rejectedKeystrokes + result.mistakes.length,
    })
    return { entry, result }
  },
}))
