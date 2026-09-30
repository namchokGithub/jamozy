import type { CachedGlyph, GlyphReview } from './types'

/** A UI-only draft; ReviewStore receives it only after the reviewer saves. */
export function createUnreviewedDraft(source: CachedGlyph): GlyphReview {
  return {
    reviewSchemaVersion: 2,
    syllable: source.syllable,
    source: {
      extraction: source.extraction,
      sourceGlyphHash: source.sourceGlyphHash,
    },
    status: 'unreviewed',
    blockers: ['unassigned-source-geometry', 'empty-physical-step'],
    steps: source.physicalSteps.map(({ order, jamo }) => ({
      order,
      jamo,
      geometry: [],
    })),
    splitRecipes: [],
  }
}
