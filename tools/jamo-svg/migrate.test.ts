import { expect, test } from 'vitest'
import { migrateStepAlgorithmReview, migrateV1Review } from './migrate'
import type { Bounds, CachedGlyph, GeometryRef, GlyphReview } from './types'

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
      {
        order: 2,
        jamo: 'ㅂ',
        geometry: [
          { kind: 'split-piece', recipeId: 'final', pieceId: 'bieup' },
        ],
      },
      {
        order: 3,
        jamo: 'ㅅ',
        geometry: [{ kind: 'split-piece', recipeId: 'final', pieceId: 'siot' }],
      },
    ],
    splitRecipes: [
      {
        splitRecipeSchemaVersion: 1,
        id: 'final',
        sourceContourId: 2,
        sourceContourHash: 'contour',
        method: 'source-command-partition',
        rationale: 'verified',
        visualValidation: { sourceContourHash: 'contour' },
        pieces: [
          {
            id: 'bieup',
            ownerStep: 2,
            tokens: [{ kind: 'source-range', fromCommand: 0, toCommand: 3 }],
          },
          {
            id: 'siot',
            ownerStep: 3,
            tokens: [{ kind: 'source-range', fromCommand: 4, toCommand: 7 }],
          },
        ],
      },
    ],
  }

  const result = migrateV1Review(review)

  expect(result.diagnostics).toEqual([])
  expect(result.review.reviewSchemaVersion).toBe(2)
  expect(result.review.splitRecipes[0].splitRecipeSchemaVersion).toBe(2)
  expect(result.review.splitRecipes[0].pieces).toEqual([
    {
      id: 'bieup',
      tokens: [{ kind: 'source-range', fromCommand: 0, toCommand: 3 }],
    },
    {
      id: 'siot',
      tokens: [{ kind: 'source-range', fromCommand: 4, toCommand: 7 }],
    },
  ])
})

const v3Source = (
  steps: Array<[string, 'choseong' | 'jungseong' | 'jongseong']>,
) =>
  ({
    syllable: '화',
    extraction: {
      fontSha256: 'font',
      extractionSchema: 1,
      pathNormalization: 1,
      physicalStepAlgorithm: 3,
    },
    physicalSteps: steps.map(([jamo, slot], order) => ({ order, jamo, slot })),
  }) as unknown as CachedGlyph
const v2Review = (
  steps: string[][],
  status: GlyphReview['status'] = 'approved',
) =>
  ({
    reviewSchemaVersion: 2,
    syllable: '화',
    source: {
      extraction: {
        fontSha256: 'font',
        extractionSchema: 1,
        pathNormalization: 1,
        physicalStepAlgorithm: 2,
      },
      sourceGlyphHash: 'glyph',
    },
    status,
    blockers: [],
    steps: steps.map(([jamo, ...contours], order) => ({
      order,
      jamo,
      geometry: contours.map((id) => ({
        kind: 'contour',
        contourId: Number(id),
      })),
    })),
    splitRecipes: [],
    approved:
      status === 'approved'
        ? {
            at: 'then',
            reviewer: 'r',
            validatorVersion: 1,
            validationHash: 'h',
          }
        : undefined,
  }) as unknown as GlyphReview
// Contour 1 is a wide ㅗ bar; contour 2 is a tall ㅏ stem.
const shapes: Record<number, Bounds> = {
  0: { x1: 0, y1: 0, x2: 500, y2: 500 },
  1: { x1: 0, y1: 900, x2: 800, y2: 1100 },
  2: { x1: 900, y1: 100, x2: 1100, y2: 1900 },
}
const boundsOf = (ref: GeometryRef) =>
  ref.kind === 'contour' ? shapes[ref.contourId] : undefined
const wa = v3Source([
  ['ㅎ', 'choseong'],
  ['ㅗ', 'jungseong'],
  ['ㅏ', 'jungseong'],
])

test('keeps approval when the v3 step sequence is unchanged', () => {
  const result = migrateStepAlgorithmReview(
    v2Review([
      ['ㄱ', '0'],
      ['ㅏ', '2'],
    ]),
    v3Source([
      ['ㄱ', 'choseong'],
      ['ㅏ', 'jungseong'],
    ]),
    boundsOf,
  )

  expect(result.diagnostics).toEqual([])
  expect(result.review.status).toBe('approved')
  expect(result.review.approved).toBeDefined()
  expect(result.review.source.extraction.physicalStepAlgorithm).toBe(3)
})

test('divides a compound medial into its typed keys by shape and clears approval', () => {
  const result = migrateStepAlgorithmReview(
    v2Review([
      ['ㅎ', '0'],
      ['ㅘ', '2', '1'],
    ]),
    wa,
    boundsOf,
  )

  expect(result.diagnostics).toEqual([])
  expect(result.review.status).toBe('reviewing')
  expect(result.review.approved).toBeUndefined()
  expect(result.review.steps).toEqual([
    { order: 0, jamo: 'ㅎ', geometry: [{ kind: 'contour', contourId: 0 }] },
    { order: 1, jamo: 'ㅗ', geometry: [{ kind: 'contour', contourId: 1 }] },
    { order: 2, jamo: 'ㅏ', geometry: [{ kind: 'contour', contourId: 2 }] },
  ])
})

test('marks a compound medial that cannot be divided by shape as needs-split', () => {
  const result = migrateStepAlgorithmReview(
    v2Review(
      [
        ['ㅎ', '0'],
        ['ㅘ', '2'],
      ],
      'reviewing',
    ),
    wa,
    boundsOf,
  )

  expect(result.diagnostics).toEqual([
    '화: cannot divide ㅘ into ㅗ + ㅏ by shape.',
  ])
  expect(result.review.blockers).toContain('needs-split')
  expect(result.review.steps.map(({ geometry }) => geometry.length)).toEqual([
    1, 1, 0,
  ])
})
