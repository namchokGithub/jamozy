export interface UserSettings {
  soundEnabled: boolean
  keyboardLayoutHint: boolean
}

export interface UserProfile {
  id: string
  exp: number
  settings: UserSettings
  createdAt: Date
}

export function levelFromExp(exp: number): number {
  return 1 + Math.floor(exp / 100)
}
