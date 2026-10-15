import type { UserSettings } from '../../domain/models/user-profile'

// Read by the boot script in index.html, so a reload paints the saved
// theme before React renders; keep the two keys in sync.
export const THEME_STORAGE_KEY = 'jamozy-theme'

/** Shows the given theme and remembers it on this device. */
export function applyTheme(theme: UserSettings['theme']) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage can be unavailable (private mode); the theme still applies.
  }
}
