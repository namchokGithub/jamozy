import type { HomeLessonRef } from '../domain/home/home-session'
import type { HomeContent } from '../domain/models/home-content'
import type { Progress } from '../domain/models/progress'
import type { HomeContentRepository } from '../domain/repositories/home-content-repository'
import type { HomeLocalStateRepository } from '../domain/repositories/home-local-state-repository'
import type { ProgressRepository } from '../domain/repositories/progress-repository'

export interface HomePlayerData {
  content: HomeContent
  // Last known Progress of Home lessons; live Progress arrives separately.
  progress: Progress[]
  // Exercises still waiting in the outbox, by lesson.
  pendingExerciseIds: Record<string, string[]>
  resume: HomeLessonRef | null
}

export interface GetHomePlayerDeps {
  contentRepo: HomeContentRepository
  localState: HomeLocalStateRepository
  pendingExerciseIds: (userId: string) => Promise<Map<string, Set<string>>>
}

// Everything Home needs to start playing, all from the static export and
// this device (DEC-043). Null when no Home content is deployed.
export async function getHomePlayer(
  deps: GetHomePlayerDeps,
  userId: string,
): Promise<HomePlayerData | null> {
  const [content, progress, resume, pending] = await Promise.all([
    deps.contentRepo.getHomeContent(),
    deps.localState.getCachedProgress(userId),
    deps.localState.getResume(userId),
    deps.pendingExerciseIds(userId),
  ])
  if (!content) return null
  return {
    content,
    progress,
    pendingExerciseIds: Object.fromEntries(
      [...pending].map(([lessonId, ids]) => [lessonId, [...ids]]),
    ),
    resume,
  }
}

// Live Progress for Home lessons, read in the background after Home is
// already playable; it also refreshes the device cache.
export async function refreshHomeProgress(
  deps: {
    progressRepo: ProgressRepository
    localState: HomeLocalStateRepository
  },
  userId: string,
  content: HomeContent,
): Promise<Progress[]> {
  const lessonIds = new Set(
    content.units.flatMap(({ lessons }) => lessons.map(({ id }) => id)),
  )
  const progress = (await deps.progressRepo.getAllProgress(userId)).filter(
    ({ lessonId }) => lessonIds.has(lessonId),
  )
  await deps.localState.saveCachedProgress(userId, progress)
  return progress
}
