import type { ExerciseDifficulty } from './lesson'

// Per-exercise EXP rewards (DEC-045, DEC-046; docs/LEVELING.md → EXP
// Calculation). `practice` covers completed-lesson replays, Review, and
// Practice items.
export type ExpRewardKind = 'first-completion' | 'practice'

export interface ExpRewardItem {
  // Absent difficulty counts as easy.
  difficulty?: ExerciseDifficulty
  kind: ExpRewardKind
  // No mistakes in this exercise; earns the bonus on a first completion only.
  perfect?: boolean
}

const BASE_EXP: Record<ExpRewardKind, Record<ExerciseDifficulty, number>> = {
  'first-completion': { easy: 15, medium: 25, hard: 30 },
  practice: { easy: 3, medium: 5, hard: 10 },
}

export const PERFECT_FLAT_BONUS = 5

// round((Base EXP + Flat Bonus) × (1 + Total EXP Bonus)). Perk and
// achievement bonuses do not exist yet, so callers pass none.
export function exerciseRewardExp(
  item: ExpRewardItem,
  bonus: { flat?: number; percent?: number } = {},
): number {
  const base = BASE_EXP[item.kind][item.difficulty ?? 'easy']
  const perfect =
    item.kind === 'first-completion' && item.perfect ? PERFECT_FLAT_BONUS : 0
  return Math.round(
    (base + perfect + (bonus.flat ?? 0)) * (1 + (bonus.percent ?? 0)),
  )
}

export function sessionRewardExp(items: ExpRewardItem[]): number {
  return items.reduce((sum, item) => sum + exerciseRewardExp(item), 0)
}
