import type { HomeOutbox } from '../application/home-outbox'
import type { HomeLocalStateRepository } from '../domain/repositories/home-local-state-repository'
import type { HomeServices } from '../features/home/home-services'

// Background writes for the Home player (DEC-043). Nothing here is awaited
// by the UI; failures are retried by the outbox or, for the local resume
// pointer, simply skipped.
export function createHomeServices(deps: {
  outbox: HomeOutbox
  localState: HomeLocalStateRepository
  getActiveUser: () => Promise<{ uid: string }>
}): HomeServices {
  const inBackground = (work: () => Promise<void>) => {
    work().catch((error: unknown) => {
      if (import.meta.env.DEV)
        console.warn('[home] Background write failed.', error)
    })
  }
  return {
    recordExercise: ({ lesson, result }) =>
      inBackground(async () => {
        const { uid } = await deps.getActiveUser()
        await deps.outbox.enqueueExercise({
          userId: uid,
          lesson: {
            id: lesson.id,
            type: lesson.type,
            exercises: lesson.exercises.map(({ id }) => ({ id })),
          },
          result,
          // Used only if this is the lesson's first recorded exercise.
          submissionId: crypto.randomUUID(),
        })
      }),
    recordReplay: ({ lessonId, lessonType, totals }) =>
      inBackground(async () => {
        const { uid } = await deps.getActiveUser()
        await deps.outbox.enqueueReplay({
          userId: uid,
          lessonId,
          sessionId: crypto.randomUUID(),
          totals,
          lessonType,
        })
      }),
    saveResume: (resume) =>
      inBackground(async () => {
        const { uid } = await deps.getActiveUser()
        await deps.localState.saveResume(uid, resume)
      }),
  }
}
