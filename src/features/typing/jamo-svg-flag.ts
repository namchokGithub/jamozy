export const JAMO_SVG_RENDERER_STORAGE_KEY = 'jamozy:jamo-svg-renderer'

/** SVG target renderer flag (DEC-039): build env, with a DEV-only local override. */
export function isJamoSvgRendererEnabled(): boolean {
  const fromBuild = import.meta.env.VITE_JAMO_SVG_RENDERER === '1'
  if (!import.meta.env.DEV) return fromBuild
  try {
    const override = window.localStorage.getItem(JAMO_SVG_RENDERER_STORAGE_KEY)
    if (override === '1') return true
    if (override === '0') return false
  } catch {
    // Storage unavailable: no override.
  }
  return fromBuild
}
