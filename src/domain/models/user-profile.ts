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
