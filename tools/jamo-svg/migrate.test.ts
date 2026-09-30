import { expect, test } from 'vitest'
import { migrateStepAlgorithmReview, migrateV1Review } from './migrate'
import type { CachedGlyph, GlyphReview } from './types'

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

const v2Source = (steps: Array<[string, 'choseong' | 'jungseong' | 'jongseong']>) =>
  ({
    syllable: '화',
    extraction: { fontSha256: 'font', extractionSchema: 1, pathNormalization: 1, physicalStepAlgorithm: 2 },
    physicalSteps: steps.map(([jamo, slot], order) => ({ order, jamo, slot })),
  }) as unknown as CachedGlyph
const v1Review = (steps: string[], status: GlyphReview['status'] = 'approved') =>
  ({
    reviewSchemaVersion: 2,
    syllable: '화',
    source: { extraction: { fontSha256: 'font', extractionSchema: 1, pathNormalization: 1, physicalStepAlgorithm: 1 }, sourceGlyphHash: 'glyph' },
    status,
    blockers: [],
    steps: steps.map((jamo, order) => ({ order, jamo, geometry: [{ kind: 'contour', contourId: order }] })),
    splitRecipes: [],
    approved: status === 'approved' ? { at: 'then', reviewer: 'r', validatorVersion: 1, validationHash: 'h' } : undefined,
  }) as unknown as GlyphReview

test('keeps approval when the v2 step sequence is unchanged', () => {
  const result = migrateStepAlgorithmReview(v1Review(['ㄱ', 'ㅏ']), v2Source([['ㄱ', 'choseong'], ['ㅏ', 'jungseong']]))

  expect(result.diagnostics).toEqual([])
  expect(result.review.status).toBe('approved')
  expect(result.review.approved).toBeDefined()
  expect(result.review.source.extraction.physicalStepAlgorithm).toBe(2)
})

test('merges compound medial parts into one step and clears approval', () => {
  const result = migrateStepAlgorithmReview(v1Review(['ㅎ', 'ㅗ', 'ㅏ']), v2Source([['ㅎ', 'choseong'], ['ㅘ', 'jungseong']]))

  expect(result.diagnostics).toEqual([])
  expect(result.review.status).toBe('reviewing')
  expect(result.review.approved).toBeUndefined()
  expect(result.review.steps).toEqual([
    { order: 0, jamo: 'ㅎ', geometry: [{ kind: 'contour', contourId: 0 }] },
    { order: 1, jamo: 'ㅘ', geometry: [{ kind: 'contour', contourId: 1 }, { kind: 'contour', contourId: 2 }] },
  ])
})

test('reports v1 steps that do not match the compound medial parts', () => {
  const result = migrateStepAlgorithmReview(v1Review(['ㅎ', 'ㅏ', 'ㅗ'], 'reviewing'), v2Source([['ㅎ', 'choseong'], ['ㅘ', 'jungseong']]))

  expect(result.diagnostics).toEqual(['화: cannot map v1 steps onto ㅘ.'])
})
