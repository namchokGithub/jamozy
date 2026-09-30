import { expect, test } from 'vitest'
import { migrateV1Review } from './migrate'

test('migrates split ownership from reviewed steps and preserves source tokens', () => {
  const review = {
    reviewSchemaVersion: 1,
    syllable: '값',
    source: { extraction: {}, sourceGlyphHash: 'glyph' },
    status: 'approved',
    blockers: [],
    steps: [
      { order: 0, jamo: 'ㄱ', geometry: [] },
      { order: 1, jamo: 'ㅏ', geometry: [] },
      { order: 2, jamo: 'ㅂ', geometry: [{ kind: 'split-piece', recipeId: 'final', pieceId: 'bieup' }] },
      { order: 3, jamo: 'ㅅ', geometry: [{ kind: 'split-piece', recipeId: 'final', pieceId: 'siot' }] },
    ],
    splitRecipes: [{ splitRecipeSchemaVersion: 1, id: 'final', sourceContourId: 2, sourceContourHash: 'contour', method: 'source-command-partition', rationale: 'verified', visualValidation: { sourceContourHash: 'contour' }, pieces: [
      { id: 'bieup', ownerStep: 2, tokens: [{ kind: 'source-range', fromCommand: 0, toCommand: 3 }] },
      { id: 'siot', ownerStep: 3, tokens: [{ kind: 'source-range', fromCommand: 4, toCommand: 7 }] },
    ] }],
  }

  const result = migrateV1Review(review)

  expect(result.diagnostics).toEqual([])
  expect(result.review.reviewSchemaVersion).toBe(2)
  expect(result.review.splitRecipes[0].splitRecipeSchemaVersion).toBe(2)
  expect(result.review.splitRecipes[0].pieces).toEqual([
    { id: 'bieup', tokens: [{ kind: 'source-range', fromCommand: 0, toCommand: 3 }] },
    { id: 'siot', tokens: [{ kind: 'source-range', fromCommand: 4, toCommand: 7 }] },
  ])
})
