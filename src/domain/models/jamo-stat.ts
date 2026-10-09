import { z } from 'zod'
import { isKoreanJamoKey, JAMO_TO_KEY } from '../korean/keymap'
import { buildExpectedKeys } from '../korean/target-sequence'
import type { ExerciseResult } from '../korean/lesson-session'

// Per-learner key-level jamo stats (DEC-028, DEC-050). Rejected input is
// charged to the jamo that was expected, never the one pressed.

export interface JamoStat {
  acceptedKeystrokes: number
  rejectedKeystrokes: number
  firstPracticedAt: Date
  lastPracticedAt: Date
}
export type JamoStats = Record<string, JamoStat>
export type JamoCounts = Record<string, { accepted: number; rejected: number }>

export const MIN_RANKED_JAMO_ATTEMPTS = 20
const MAX_COUNT_PER_SESSION = 10_000

// A Hangul letter key only: JAMO_TO_KEY also maps the space bar.
const isJamo = (jamo: string) =>
  Object.hasOwn(JAMO_TO_KEY, jamo) && isKoreanJamoKey(JAMO_TO_KEY[jamo].code)
const count = z.number().int().min(0).max(MAX_COUNT_PER_SESSION)

export const jamoCountsSchema = z
  .record(z.string(), z.object({ accepted: count, rejected: count }))
  .refine((counts) => Object.keys(counts).every(isJamo))

function bump(
  counts: JamoCounts,
  jamo: string,
  field: 'accepted' | 'rejected',
) {
  if (!isJamo(jamo)) return
  const entry = (counts[jamo] ??= { accepted: 0, rejected: 0 })
  entry[field] += 1
}

// Admin rejects untypeable targets; an old one still must not fail a submit.
function typeableKeys(targetText: string) {
  try {
    return buildExpectedKeys(targetText)
  } catch {
    return []
  }
}

/** Key-level jamo of a target; literal keys and untypeable targets give none. */
export function jamoKeysOf(targetText: string): string[] {
  return typeableKeys(targetText)
    .filter((key) => key.slot !== 'literal' && isJamo(key.jamo))
    .map((key) => key.jamo)
}

export function jamoCountsFrom(
  results: Array<Pick<ExerciseResult, 'targetText' | 'mistakes'>>,
): JamoCounts {
  const counts: JamoCounts = {}
  for (const result of results) {
    for (const jamo of jamoKeysOf(result.targetText))
      bump(counts, jamo, 'accepted')
    for (const mistake of result.mistakes)
      bump(counts, mistake.expectedJamo, 'rejected')
  }
  return counts
}

export function mergeJamoCounts(
  a: JamoCounts | undefined,
  b: JamoCounts,
): JamoCounts {
  const merged: JamoCounts = {}
  for (const source of [a ?? {}, b])
    for (const [jamo, { accepted, rejected }] of Object.entries(source)) {
      const entry = (merged[jamo] ??= { accepted: 0, rejected: 0 })
      entry.accepted += accepted
      entry.rejected += rejected
    }
  return merged
}

export function applyJamoCounts(
  current: JamoStats,
  counts: JamoCounts,
  now: Date,
): JamoStats {
  const next: JamoStats = { ...current }
  for (const [jamo, { accepted, rejected }] of Object.entries(counts)) {
    if (accepted + rejected === 0) continue
    const existing = current[jamo]
    next[jamo] = {
      acceptedKeystrokes: (existing?.acceptedKeystrokes ?? 0) + accepted,
      rejectedKeystrokes: (existing?.rejectedKeystrokes ?? 0) + rejected,
      // Home outbox jobs can submit after newer sessions, so never move the
      // first practice later or the last practice earlier.
      firstPracticedAt:
        existing && existing.firstPracticedAt < now
          ? existing.firstPracticedAt
          : now,
      lastPracticedAt:
        existing && existing.lastPracticedAt > now
          ? existing.lastPracticedAt
          : now,
    }
  }
  return next
}

export interface RankedJamo {
  jamo: string
  attempts: number
  rejected: number
  mistakeRate: number
}

// The highest score wins; a tie goes to the jamo practiced more.
function top(
  items: RankedJamo[],
  score: (item: RankedJamo) => number,
): RankedJamo | null {
  return items.reduce<RankedJamo | null>((best, item) => {
    if (!best) return item
    const diff = score(item) - score(best)
    return diff > 0 || (diff === 0 && item.attempts > best.attempts)
      ? item
      : best
  }, null)
}

export function jamoRankings(stats: JamoStats): {
  mostPracticed: RankedJamo | null
  mostMistyped: RankedJamo | null
  weakest: RankedJamo | null
  strongest: RankedJamo | null
} {
  const ranked: RankedJamo[] = Object.entries(stats).map(([jamo, stat]) => {
    const attempts = stat.acceptedKeystrokes + stat.rejectedKeystrokes
    return {
      jamo,
      attempts,
      rejected: stat.rejectedKeystrokes,
      mistakeRate: attempts === 0 ? 0 : stat.rejectedKeystrokes / attempts,
    }
  })
  // A few early attempts swing the rate, so only practiced jamo are ranked.
  const eligible = ranked.filter(
    (item) => item.attempts >= MIN_RANKED_JAMO_ATTEMPTS,
  )
  return {
    mostPracticed: top(ranked, (item) => item.attempts),
    mostMistyped: top(
      ranked.filter((item) => item.rejected > 0),
      (item) => item.rejected,
    ),
    weakest: top(eligible, (item) => item.mistakeRate),
    strongest: top(eligible, (item) => -item.mistakeRate),
  }
}
