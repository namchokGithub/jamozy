import { z } from 'zod'

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
  exp: number
  settings: UserSettings
  stats: UserStats
  createdAt: Date
}

export function levelFromExp(exp: number): number {
  return 1 + Math.floor(exp / 100)
}

export function defaultUserProfile(userId: string, now: Date): UserProfile {
  return {
    id: userId,
    exp: 0,
    settings: {
      soundEnabled: true,
      showKeyboard: true,
      showEnglishKeys: true,
      keyboardOpacity: 1,
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
