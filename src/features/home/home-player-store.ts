import { create } from 'zustand'
import { shuffleExercises } from '../../domain/home/home-session'
import {
  pressKey as pressKeyReducer,
  startLessonSession,
  type ExerciseResult,
  type LessonSessionState,
} from '../../domain/korean/lesson-session'
import type { HomeLesson } from '../../domain/models/home-content'

// One Home session: a lesson's exercises in a fresh shuffled order (DEC-043).
interface HomePlayerStore {
  unitId: string | null
  lesson: HomeLesson | null
  exercises: HomeLesson['exercises']
  session: LessonSessionState | null
  // The lesson was already completed when this session started, so
  // finishing it is a replay.
  isReplay: boolean
  // Transient UI state; loader data stays out of this store.
  selectedUnitId: string | null
  courseComplete: boolean
  notice: string | null
  selectUnit: (unitId: string) => void
  finishCourse: (notice: string) => void
  showNotice: (notice: string | null) => void
  startLesson: (
    unitId: string,
    lesson: HomeLesson,
    options: { isReplay: boolean; random?: () => number },
  ) => void
  pressKey: (
    code: string,
    shiftKey: boolean,
  ) => { result: ExerciseResult | null; finished: boolean }
}

export const useHomePlayerStore = create<HomePlayerStore>((set, get) => ({
  unitId: null,
  lesson: null,
  exercises: [],
  session: null,
  isReplay: false,
  selectedUnitId: null,
  courseComplete: false,
  notice: null,
  selectUnit: (selectedUnitId) => set({ selectedUnitId }),
  finishCourse: (notice) => set({ courseComplete: true, notice }),
  showNotice: (notice) => set({ notice }),
  startLesson: (unitId, lesson, { isReplay, random }) => {
    const exercises = shuffleExercises(lesson.exercises, random)
    set({
      unitId,
      selectedUnitId: unitId,
      courseComplete: false,
      lesson,
      exercises,
      isReplay,
      session: startLessonSession(
        exercises.map(({ id, targetText }) => ({ id, targetText })),
      ),
    })
  },
  pressKey: (code, shiftKey) => {
    const { session } = get()
    if (!session || session.status === 'completed')
      return { result: null, finished: false }
    const next = pressKeyReducer(session, code, shiftKey)
    set({ session: next })
    return {
      result: next.lastCompletedExercise,
      finished: next.status === 'completed',
    }
  },
}))
