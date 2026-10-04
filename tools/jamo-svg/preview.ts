import { compileReview, validateReview } from './compile'
import type { CachedGlyph, GlyphReview } from './types'

/** Invalid drafts remain inspectable; only valid reviews produce export paths. */
export function previewReview(source: CachedGlyph, review: GlyphReview) {
  const validation = validateReview(source, review)
  try {
    return { compiled: compileReview(source, review), validation }
  } catch {
    return {
      compiled: { width: source.advanceWidth, paths: source.physicalSteps.map((step) => ({ jamo: step.jamo, d: '' })) },
      validation,
    }
  }
}
