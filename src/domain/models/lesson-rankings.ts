import type { Progress } from './progress'

// Lesson item stats (DEC-050), derived from stored lessonProgress only.
export function lessonRankings(progress: Progress[]): {
  bestAccuracy: { lessonId: string; bestAccuracy: number } | null
  mostReplayed: { lessonId: string; replays: number } | null
} {
  const completed = progress.filter((entry) => entry.status === 'completed')
  const best = completed.reduce<Progress | null>(
    (top, entry) =>
      !top || entry.bestAccuracy > top.bestAccuracy ? entry : top,
    null,
  )
  const replayed = completed
    .filter((entry) => entry.attempts > 1)
    .reduce<Progress | null>(
      (top, entry) => (!top || entry.attempts > top.attempts ? entry : top),
      null,
    )
  return {
    bestAccuracy: best
      ? { lessonId: best.lessonId, bestAccuracy: best.bestAccuracy }
      : null,
    mostReplayed: replayed
      ? { lessonId: replayed.lessonId, replays: replayed.attempts - 1 }
      : null,
  }
}
