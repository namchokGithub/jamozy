import { createContext, useContext } from 'react'
import type { HomeLessonRef } from '../../domain/home/home-session'
import type { ExerciseResult } from '../../domain/korean/lesson-session'
import type { HomeLesson } from '../../domain/models/home-content'
import type { LessonType } from '../../domain/models/lesson'
import type { HomeSessionTotals } from '../../domain/models/home-sync-job'

// Home's background writes (DEC-043). Each call returns at once; the app
// layer queues the work in the outbox, so typing never waits on it.
export interface HomeServices {
  recordExercise: (input: {
    lesson: HomeLesson
    result: ExerciseResult
  }) => void
  recordReplay: (input: { lessonId: string; lessonType?: LessonType; totals: HomeSessionTotals }) => void
  saveResume: (resume: HomeLessonRef) => void
}

const HomeServicesContext = createContext<HomeServices | null>(null)

export const HomeServicesProvider = HomeServicesContext.Provider

export function useHomeServices(): HomeServices {
  const services = useContext(HomeServicesContext)
  if (!services) throw new Error('HomeServicesProvider is missing.')
  return services
}
