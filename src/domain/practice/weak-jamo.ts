import type { HomeContent } from '../models/home-content'
import {
  jamoKeysOf,
  MIN_RANKED_JAMO_ATTEMPTS,
  recentMistakeRate,
  type JamoStats,
} from '../models/jamo-stat'
import type { LessonType } from '../models/lesson'

// Weak Jamo practice (DEC-051): picks the learner's weakest key-level jamo and
// Home exercises that drill them. Policy numbers are not schema.
export const WEAK_JAMO_TARGETS = 3
export const WEAK_JAMO_SESSION_SIZE = 10
export const WEAK_JAMO_POOL_SIZE = 30

export interface WeakJamoTarget {
  jamo: string
  mistakeRate: number
  attempts: number
}

export interface PracticeExercise {
  // `${lessonId}:${exerciseId}`: Home exercise ids are unique per lesson only.
  id: string
  targetText: string
  lessonType: LessonType
}

export function weakJamoTargets(stats: JamoStats): WeakJamoTarget[] {
  return Object.entries(stats)
    .map(([jamo, stat]) => {
      const attempts = stat.acceptedKeystrokes + stat.rejectedKeystrokes
      return {
        jamo,
        attempts,
        mistakeRate: recentMistakeRate(stat),
      }
    })
    .filter(
      (target) =>
        target.attempts >= MIN_RANKED_JAMO_ATTEMPTS && target.mistakeRate > 0,
    )
    .sort((a, b) => b.mistakeRate - a.mistakeRate || b.attempts - a.attempts)
    .slice(0, WEAK_JAMO_TARGETS)
}

export function weakJamoScore(
  targetText: string,
  targets: WeakJamoTarget[],
): number {
  const rates = new Map(
    targets.map((target) => [target.jamo, target.mistakeRate]),
  )
  return jamoKeysOf(targetText).reduce(
    (sum, jamo) => sum + (rates.get(jamo) ?? 0),
    0,
  )
}

export function selectWeakJamoExercises(
  targets: WeakJamoTarget[],
  exercises: PracticeExercise[],
  random: () => number = Math.random,
): PracticeExercise[] {
  if (targets.length === 0) return []
  const seen = new Set<string>()
  const pool = exercises
    .filter((exercise) => {
      if (seen.has(exercise.id)) return false
      seen.add(exercise.id)
      return true
    })
    .map((exercise) => ({
      exercise,
      score: weakJamoScore(exercise.targetText, targets),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, WEAK_JAMO_POOL_SIZE)
    .map((entry) => entry.exercise)
  // Fisher-Yates, so each round draws a different set from the pool.
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[pool[index], pool[swap]] = [pool[swap], pool[index]]
  }
  return pool.slice(0, WEAK_JAMO_SESSION_SIZE)
}

export function homePracticeExercises(
  content: HomeContent,
): PracticeExercise[] {
  return content.units.flatMap((unit) =>
    unit.lessons.flatMap((lesson) =>
      lesson.exercises.map((exercise) => ({
        id: `${lesson.id}:${exercise.id}`,
        targetText: exercise.targetText,
        lessonType: lesson.type,
      })),
    ),
  )
}
