import { buildExpectedKeys } from '../../domain/korean/target-sequence'
import { loadJamoSvgGlyphs } from '../../infrastructure/jamo-svg/jamo-svg-dataset'
import { svgTargetSyllables, targetSyllables } from './hangul-target-selection'
import { isJamoSvgRendererEnabled } from './jamo-svg-flag'

/**
 * Starts loading the Jamo SVG shards for upcoming targets, so HangulTarget
 * finds them in memory and shows the SVG at once instead of pending tiles.
 * Best effort: does nothing when the SVG renderer is off, skips text the
 * renderer would not draw as SVG, and never throws.
 */
export function prefetchHangulTargets(targetTexts: readonly string[]): void {
  if (!isJamoSvgRendererEnabled()) return
  const syllables = new Set<string>()
  for (const text of targetTexts) {
    try {
      const groups = svgTargetSyllables(text, buildExpectedKeys(text))
      if (groups)
        for (const syllable of targetSyllables(groups)) syllables.add(syllable)
    } catch {
      // Text the keyboard cannot type falls back to Canvas anyway.
    }
  }
  if (syllables.size === 0) return
  void loadJamoSvgGlyphs([...syllables]).catch(() => undefined)
}
