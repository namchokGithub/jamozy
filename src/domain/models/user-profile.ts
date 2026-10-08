import { z } from 'zod'
import type { LegacyBaseline, SessionAggregate } from './session-aggregate'

export interface UserSettings {
  soundEnabled: boolean
  showKeyboard: boolean
  showEnglishKeys: boolean
  keyboardOpacity: number
  romanizationEnabled: boolean
  meaningLanguage: 'th' | 'en' | 'both'
  theme: 'light' | 'dark'
}

export interface UserStats {
  lessonsCompleted: number
  wordsPracticed: number
  averageAccuracy: number
  bestAccuracy: number
  averageSpeedWpm: number
  totalTypingTimeSeconds: number
}

export interface UserProfile {
  id: string
  displayName?: string
  exp: number
  settings: UserSettings
  stats: UserStats
  createdAt: Date
  updatedAt?: Date
  legacyBaseline?: LegacyBaseline
  sessionAggregate?: SessionAggregate
}

export interface LevelProgress {
  level: number
  expIntoLevel: number
  expToNextLevel: number
}

// EXP needed to go from `level` to `level + 1` in the current rebirth cycle
// (DEC-048). The soft cap triples from Level 100 and every ten levels after.
export function expRequiredForNextLevel(
  level: number,
  rebirthCount = 0,
): number {
  const baseExp = 50 * level ** 1.2
  const rebirthMultiplier = 1 + 0.15 * rebirthCount
  const softCapMultiplier =
    level < 100 ? 1 : 3 ** (Math.floor((level - 100) / 10) + 1)
  return Math.round(baseExp * rebirthMultiplier * softCapMultiplier)
}

export function levelProgress(exp: number, rebirthCount = 0): LevelProgress {
  let remaining = Number.isFinite(exp) ? Math.max(0, exp) : 0
  let level = 1
  let required = expRequiredForNextLevel(level, rebirthCount)
  while (remaining >= required) {
    remaining -= required
    level += 1
    required = expRequiredForNextLevel(level, rebirthCount)
  }
  return { level, expIntoLevel: remaining, expToNextLevel: required }
}

export function levelFromExp(exp: number, rebirthCount = 0): number {
  return levelProgress(exp, rebirthCount).level
}

// Legacy profile EXP plus EXP recorded through session submissions.
export function totalExp(
  profile: Pick<UserProfile, 'exp' | 'sessionAggregate'>,
): number {
  return profile.exp + (profile.sessionAggregate?.exp ?? 0)
}

export function defaultUserProfile(
  userId: string,
  now: Date,
  displayName = 'Guest',
): UserProfile {
  return {
    id: userId,
    displayName,
    exp: 0,
    settings: {
      soundEnabled: true,
      showKeyboard: true,
      showEnglishKeys: true,
      keyboardOpacity: 0.7,
      romanizationEnabled: true,
      meaningLanguage: 'both',
      theme: 'light',
    },
    stats: {
      lessonsCompleted: 0,
      wordsPracticed: 0,
      averageAccuracy: 0,
      bestAccuracy: 0,
      averageSpeedWpm: 0,
      totalTypingTimeSeconds: 0,
    },
    createdAt: now,
    updatedAt: now,
  }
}

export const userSettingsSchema = z.object({
  soundEnabled: z.boolean(),
  showKeyboard: z.boolean(),
  showEnglishKeys: z.boolean(),
  keyboardOpacity: z.number().min(0).max(1),
  romanizationEnabled: z.boolean(),
  meaningLanguage: z.enum(['th', 'en', 'both']),
  theme: z.enum(['light', 'dark']),
})
