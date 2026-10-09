import type { HomeContentRepository } from '../domain/repositories/home-content-repository'
import type { JamoStatsRepository } from '../domain/repositories/jamo-stats-repository'
import {
  homePracticeExercises,
  selectWeakJamoExercises,
  WEAK_JAMO_SESSION_SIZE,
  weakJamoScore,
  weakJamoTargets,
  type PracticeExercise,
  type WeakJamoTarget,
} from '../domain/practice/weak-jamo'

export interface WeakJamoDeps {
  jamoStatsRepo: JamoStatsRepository
  contentRepo: HomeContentRepository
}

export interface WeakJamoSummary {
  targets: WeakJamoTarget[]
  // Exercises one session would play, capped at the session size.
  available: number
}

// Weak Jamo practice (DEC-051) is optional: a failed read only hides it.
async function readCandidates(deps: WeakJamoDeps, userId: string) {
  try {
    const [stats, content] = await Promise.all([
      deps.jamoStatsRepo.getJamoStats(userId),
      deps.contentRepo.getHomeContent(),
    ])
    if (!content) return null
    const targets = weakJamoTargets(stats)
    if (targets.length === 0) return null
    return { targets, exercises: homePracticeExercises(content) }
  } catch {
    return null
  }
}

export async function getWeakJamoSummary(
  deps: WeakJamoDeps,
  userId: string,
): Promise<WeakJamoSummary | null> {
  const candidates = await readCandidates(deps, userId)
  if (!candidates) return null
  const matching = candidates.exercises.filter(
    (exercise) => weakJamoScore(exercise.targetText, candidates.targets) > 0,
  ).length
  if (matching === 0) return null
  return {
    targets: candidates.targets,
    available: Math.min(WEAK_JAMO_SESSION_SIZE, matching),
  }
}

export async function getWeakJamoPractice(
  deps: WeakJamoDeps,
  userId: string,
  random?: () => number,
): Promise<{ targets: WeakJamoTarget[]; exercises: PracticeExercise[] } | null> {
  const candidates = await readCandidates(deps, userId)
  if (!candidates) return null
  const exercises = selectWeakJamoExercises(
    candidates.targets,
    candidates.exercises,
    random,
  )
  return exercises.length === 0
    ? null
    : { targets: candidates.targets, exercises }
}
