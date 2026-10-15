import type { UserSettings } from '../../domain/models/user-profile'

export type ThemeSetting = UserSettings['theme']
export type ResolvedTheme = 'light' | 'dark'

// Read by the boot script in index.html, so a reload paints the saved
// theme before React renders; keep the key and attribute names in sync.
export const THEME_STORAGE_KEY = 'jamozy-theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

/** The theme to paint: `system` takes the device's preference. */
export function resolveTheme(
  theme: ThemeSetting,
  prefersDark: boolean,
): ResolvedTheme {
  if (theme === 'system') return prefersDark ? 'dark' : 'light'
  return theme
}

/**
 * Shows the given theme and remembers it on this device. `data-theme` holds
 * the painted theme; `data-theme-setting` holds the choice, which the boot
 * script reads to follow device changes while the choice is `system`.
 */
export function applyTheme(theme: ThemeSetting) {
  const prefersDark =
    typeof window.matchMedia === 'function' &&
    window.matchMedia(DARK_QUERY).matches
  const root = document.documentElement
  root.dataset.themeSetting = theme
  root.dataset.theme = resolveTheme(theme, prefersDark)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage can be unavailable (private mode); the theme still applies.
  }
}
