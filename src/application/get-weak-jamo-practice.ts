import type { HomeContentRepository } from '../domain/repositories/home-content-repository'
import type { JamoStatsRepository } from '../domain/repositories/jamo-stats-repository'
import type { JamoStats } from '../domain/models/jamo-stat'
import { practicableJamo } from '../domain/practice/jamo-grid'
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

export interface JamoOverview {
  stats: JamoStats
  weakJamo: WeakJamoSummary | null
  // Jamo keys at least one Home exercise drills (tappable grid cells).
  practicable: string[]
}

// A learner-chosen jamo is drilled only when it is ranked the same way as
// the automatic targets: enough attempts and at least one mistake.
function chosenTarget(stats: JamoStats, jamo: string): WeakJamoTarget[] {
  return weakJamoTargets({ ...(stats[jamo] ? { [jamo]: stats[jamo] } : {}) })
}

// Weak Jamo practice (DEC-051) is optional: a failed read only hides it.
async function readCandidates(
  deps: WeakJamoDeps,
  userId: string,
  focusJamo?: string,
) {
  try {
    const [stats, content] = await Promise.all([
      deps.jamoStatsRepo.getJamoStats(userId),
      deps.contentRepo.getHomeContent(),
    ])
    if (!content) return null
    const targets = focusJamo
      ? chosenTarget(stats, focusJamo)
      : weakJamoTargets(stats)
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
  focusJamo?: string,
): Promise<{ targets: WeakJamoTarget[]; exercises: PracticeExercise[] } | null> {
  const candidates = await readCandidates(deps, userId, focusJamo)
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

/** Per-jamo stats for the Review grid; null only when stats cannot be read. */
export async function getJamoOverview(
  deps: WeakJamoDeps,
  userId: string,
): Promise<JamoOverview | null> {
  let stats: JamoStats
  try {
    stats = await deps.jamoStatsRepo.getJamoStats(userId)
  } catch {
    return null
  }
  const [weakJamo, practicable] = await Promise.all([
    getWeakJamoSummary(deps, userId),
    deps.contentRepo
      .getHomeContent()
      .then((content) =>
        content ? [...practicableJamo(homePracticeExercises(content))] : [],
      )
      .catch(() => []),
  ])
  return { stats, weakJamo, practicable }
}
