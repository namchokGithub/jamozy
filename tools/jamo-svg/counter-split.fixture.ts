import type { CachedGlyph, GlyphReview } from './types'

/**
 * Verified 여 split: contour 0 is the ㅇ+ㅕ outline, contour 1 is ㅇ's own
 * counter, and contour 2 is the counter between ㅇ and ㅕ whose left edge is
 * ㅇ's curve. ㅇ follows that curve; ㅕ takes the counter's other three sides.
 */
export function yeoCounterSplit(
  glyph: CachedGlyph,
  status: GlyphReview['status'] = 'reviewing',
): GlyphReview {
  const outer = glyph.contours[0]
  const gap = glyph.contours[2]
  return {
    reviewSchemaVersion: 2,
    syllable: glyph.syllable,
    source: {
      extraction: glyph.extraction,
      sourceGlyphHash: glyph.sourceGlyphHash,
    },
    status,
    blockers: [],
    steps: [
      {
        order: 0,
        jamo: 'ㅇ',
        geometry: [
          { kind: 'split-piece', recipeId: 'yeo-gap', pieceId: 'ieung' },
          { kind: 'contour', contourId: 1 },
        ],
      },
      {
        order: 1,
        jamo: 'ㅕ',
        geometry: [
          { kind: 'split-piece', recipeId: 'yeo-gap', pieceId: 'yeo' },
        ],
      },
    ],
    splitRecipes: [
      {
        splitRecipeSchemaVersion: 2,
        id: 'yeo-gap',
        sourceContourId: 0,
        sourceContourHash: outer.commandHash,
        counterContours: [{ contourId: 2, contourHash: gap.commandHash }],
        method: 'source-command-partition',
        rationale: 'ㅇ/ㅕ seam follows the counter between them.',
        visualValidation: { sourceContourHash: outer.commandHash },
        pieces: [
          {
            id: 'ieung',
            tokens: [
              { kind: 'source-range', fromCommand: 0, toCommand: 3 },
              {
                kind: 'line-to-anchor',
                anchor: { contourId: 2, commandIndex: 0, point: 'end' },
                reason: 'interior-closure-seam',
              },
              {
                kind: 'source-range',
                contourId: 2,
                fromCommand: 1,
                toCommand: 3,
              },
              {
                kind: 'line-to-anchor',
                anchor: { contourId: 0, commandIndex: 10, point: 'end' },
                reason: 'interior-closure-seam',
              },
              { kind: 'source-range', fromCommand: 11, toCommand: 21 },
            ],
          },
          {
            id: 'yeo',
            tokens: [
              { kind: 'source-range', fromCommand: 4, toCommand: 10 },
              {
                kind: 'line-to-anchor',
                anchor: { contourId: 2, commandIndex: 3, point: 'end' },
                reason: 'interior-closure-seam',
              },
              {
                kind: 'source-range',
                contourId: 2,
                fromCommand: 4,
                toCommand: 7,
              },
              { kind: 'close-to-start', reason: 'interior-closure-seam' },
            ],
          },
        ],
      },
    ],
  }
}
