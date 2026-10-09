import {
  jamoKeysOf,
  MIN_RANKED_JAMO_ATTEMPTS,
  type JamoStat,
  type JamoStats,
} from '../models/jamo-stat'

// Per-jamo accuracy for the Review page (DEC-051): the 33 Hangul letter keys
// grouped as learners meet them on the keyboard.
export const JAMO_GROUPS = [
  {
    label: 'Plain consonants',
    jamo: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'],
  },
  { label: 'Tense (double)', jamo: ['ㄲ', 'ㄸ', 'ㅃ', 'ㅆ', 'ㅉ'] },
  { label: 'Cardinal vowels', jamo: ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ', 'ㅡ', 'ㅣ'] },
  {
    label: 'Compound / Y-vowels',
    jamo: ['ㅐ', 'ㅔ', 'ㅑ', 'ㅕ', 'ㅛ', 'ㅠ', 'ㅒ', 'ㅖ'],
  },
] as const

// 'pending' shows accuracy without a color until the jamo has enough
// attempts to rank (MIN_RANKED_JAMO_ATTEMPTS), so one early slip is not red.
export type JamoTone = 'none' | 'pending' | 'weak' | 'fair' | 'strong'

export interface JamoCell {
  jamo: string
  attempts: number
  // Rounded percent, or null before any attempt.
  accuracy: number | null
  tone: JamoTone
}

export function jamoCell(jamo: string, stat: JamoStat | undefined): JamoCell {
  const attempts = stat ? stat.acceptedKeystrokes + stat.rejectedKeystrokes : 0
  if (!stat || attempts === 0)
    return { jamo, attempts: 0, accuracy: null, tone: 'none' }
  const accuracy = Math.round((stat.acceptedKeystrokes / attempts) * 100)
  const tone: JamoTone =
    attempts < MIN_RANKED_JAMO_ATTEMPTS
      ? 'pending'
      : accuracy < 70
        ? 'weak'
        : accuracy < 90
          ? 'fair'
          : 'strong'
  return { jamo, attempts, accuracy, tone }
}

export function jamoGrid(
  stats: JamoStats,
): Array<{ label: string; cells: JamoCell[] }> {
  return JAMO_GROUPS.map((group) => ({
    label: group.label,
    cells: group.jamo.map((jamo) => jamoCell(jamo, stats[jamo])),
  }))
}

/** The practiced jamo closest to the ranking minimum, for the locked card. */
export function nearestToUnlock(
  stats: JamoStats,
): { jamo: string; attempts: number } | null {
  let nearest: { jamo: string; attempts: number } | null = null
  for (const [jamo, stat] of Object.entries(stats)) {
    const attempts = stat.acceptedKeystrokes + stat.rejectedKeystrokes
    if (attempts === 0 || attempts >= MIN_RANKED_JAMO_ATTEMPTS) continue
    if (!nearest || attempts > nearest.attempts) nearest = { jamo, attempts }
  }
  return nearest
}

/** Jamo keys that at least one exercise drills. */
export function practicableJamo(
  exercises: Array<{ targetText: string }>,
): Set<string> {
  return new Set(exercises.flatMap(({ targetText }) => jamoKeysOf(targetText)))
}
