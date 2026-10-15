import {
  levelFromExp,
  progressionOf,
  type UserProfile,
} from './user-profile'

export interface RebirthRecord {
  id: string
  rebirthNumber: number
  levelAtRebirth: number
  expAtRebirth: number
  createdAt: Date
}

export type RebirthResult =
  | { status: 'rebirthed' | 'already-applied'; record: RebirthRecord }
  | { status: 'ineligible'; level: number }

export function rebirthProfile(
  profile: UserProfile,
  operationId: string,
  now: Date,
): { profile: UserProfile; record: RebirthRecord } | { level: number } {
  const progression = progressionOf(profile)
  const level = levelFromExp(progression.currentExp, progression.rebirthCount)
  if (level < 100) return { level }
  const record = {
    id: operationId,
    rebirthNumber: progression.rebirthCount + 1,
    levelAtRebirth: level,
    expAtRebirth: progression.currentExp,
    createdAt: now,
  }
  return {
    record,
    profile: {
      ...profile,
      updatedAt: now,
      progression: {
        ...progression,
        currentExp: 0,
        highestLevel: Math.max(progression.highestLevel, level),
        rebirthCount: record.rebirthNumber,
        perkPointsEarned: progression.perkPointsEarned + 1,
      },
    },
  }
}
