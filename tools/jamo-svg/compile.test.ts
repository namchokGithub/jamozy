import { describe, expect, test } from 'vitest'
import {
  compileReview,
  validateReview,
  type CachedGlyph,
  type GlyphReview,
} from './compile'

const source: CachedGlyph = {
  syllable: '하',
  sourceGlyphHash: 'source-hash',
  extraction: {
    fontSha256: 'font-hash',
    extractionSchema: 1,
    pathNormalization: 1,
    physicalStepAlgorithm: 1,
  },
  advanceWidth: 1770,
  bounds: { x1: 0, y1: 0, x2: 10, y2: 10 },
  sourcePath: 'M0 0Z M1 1Z M2 2Z M3 3Z',
  contours: [
    {
      id: 0,
      d: 'M0 0Z',
      commands: [{ type: 'M', x: 0, y: 0 }, { type: 'Z' }],
      commandHash: 'a',
      bounds: { x1: 0, y1: 0, x2: 0, y2: 0 },
      commandTypes: 'MZ',
    },
    {
      id: 1,
      d: 'M1 1Z',
      commands: [{ type: 'M', x: 1, y: 1 }, { type: 'Z' }],
      commandHash: 'b',
      bounds: { x1: 1, y1: 1, x2: 1, y2: 1 },
      commandTypes: 'MZ',
    },
    {
      id: 2,
      d: 'M2 2Z',
      commands: [{ type: 'M', x: 2, y: 2 }, { type: 'Z' }],
      commandHash: 'c',
      bounds: { x1: 2, y1: 2, x2: 2, y2: 2 },
      commandTypes: 'MZ',
    },
    {
      id: 3,
      d: 'M3 3Z',
      commands: [{ type: 'M', x: 3, y: 3 }, { type: 'Z' }],
      commandHash: 'd',
      bounds: { x1: 3, y1: 3, x2: 3, y2: 3 },
      commandTypes: 'MZ',
    },
  ],
  physicalSteps: [
    { order: 0, jamo: 'ㅎ', slot: 'choseong' },
    { order: 1, jamo: 'ㅏ', slot: 'jungseong' },
  ],
  hangul: {
    choseong: 'ㅎ',
    jungseong: 'ㅏ',
    jongseong: '',
    medialLayout: 'vertical',
    compoundMedial: null,
    compoundFinal: null,
  },
  signals: {
    contourRelation: 'surplus',
    commandCount: 8,
    oneContourMultiStep: false,
  },
  family: {
    queueKey: {
      medialLayout: 'vertical',
      hasFinal: false,
      compoundMedial: null,
      compoundFinal: null,
      physicalStepCount: 2,
      contourRelation: 'surplus',
    },
    semanticKey: {
      choseong: 'ㅎ',
      jungseong: 'ㅏ',
      jongseong: '',
      medialLayout: 'vertical',
    },
  },
}

const review: GlyphReview = {
  reviewSchemaVersion: 2,
  syllable: '하',
  source: {
    extraction: source.extraction,
    sourceGlyphHash: source.sourceGlyphHash,
  },
  status: 'reviewing',
  blockers: [],
  steps: [
    {
      order: 0,
      jamo: 'ㅎ',
      geometry: [
        { kind: 'contour', contourId: 1 },
        { kind: 'contour', contourId: 2 },
        { kind: 'contour', contourId: 3 },
      ],
    },
    { order: 1, jamo: 'ㅏ', geometry: [{ kind: 'contour', contourId: 0 }] },
  ],
  splitRecipes: [],
}

describe('review compiler', () => {
  test('combines verified 하 counter contours into its ㅎ step in typing order', () => {
    expect(validateReview(source, review).blockers).toEqual([])
    expect(compileReview(source, review).paths).toEqual([
      { jamo: 'ㅎ', d: 'M1 1Z M2 2Z M3 3Z' },
      { jamo: 'ㅏ', d: 'M0 0Z' },
    ])
  })

  test('blocks approval when a source glyph hash is stale', () => {
    expect(
      validateReview(source, {
        ...review,
        source: { ...review.source, sourceGlyphHash: 'old-hash' },
      }).blockers,
    ).toContain('fingerprint-mismatch')
  })

  test('blocks duplicate source contour ownership', () => {
    expect(
      validateReview(source, {
        ...review,
        steps: [
          {
            ...review.steps[0],
            geometry: [
              ...review.steps[0].geometry,
              { kind: 'contour', contourId: 0 },
            ],
          },
          review.steps[1],
        ],
      }).blockers,
    ).toContain('duplicate-ownership')
  })

  test('blocks a split recipe that assigns one source command to multiple pieces', () => {
    const splitSource = {
      ...source,
      syllable: '가',
      sourcePath: 'M0 0 L2 0 Z',
      contours: [
        {
          id: 0,
          d: 'M0 0 L2 0 Z',
          commands: [
            { type: 'M' as const, x: 0, y: 0 },
            { type: 'L' as const, x: 2, y: 0 },
            { type: 'Z' as const },
          ],
          commandHash: 'split',
          bounds: { x1: 0, y1: 0, x2: 2, y2: 0 },
          commandTypes: 'MLZ',
        },
      ],
      physicalSteps: [
        { order: 0, jamo: 'ㄱ', slot: 'choseong' as const },
        { order: 1, jamo: 'ㅏ', slot: 'jungseong' as const },
      ],
    }
    const splitReview: GlyphReview = {
      ...review,
      syllable: '가',
      source: {
        extraction: splitSource.extraction,
        sourceGlyphHash: splitSource.sourceGlyphHash,
      },
      steps: [
        {
          order: 0,
          jamo: 'ㄱ',
          geometry: [
            { kind: 'split-piece', recipeId: 'mixed', pieceId: 'one' },
          ],
        },
        {
          order: 1,
          jamo: 'ㅏ',
          geometry: [
            { kind: 'split-piece', recipeId: 'mixed', pieceId: 'two' },
          ],
        },
      ],
      splitRecipes: [
        {
          splitRecipeSchemaVersion: 2,
          id: 'mixed',
          sourceContourId: 0,
          sourceContourHash: 'split',
          method: 'source-command-partition',
          rationale: 'test',
          visualValidation: { sourceContourHash: 'split' },
          pieces: [
            {
              id: 'one',
              tokens: [{ kind: 'source-range', fromCommand: 0, toCommand: 1 }],
            },
            {
              id: 'two',
              tokens: [
                {
                  kind: 'move-to-anchor',
                  anchor: { contourId: 0, commandIndex: 1, point: 'end' },
                },
                { kind: 'source-range', fromCommand: 1, toCommand: 2 },
              ],
            },
          ],
        },
      ],
    }

    expect(validateReview(splitSource, splitReview).blockers).toContain(
      'invalid-split-recipe',
    )
  })

  test('allows a move anchor beside an otherwise exact source partition', () => {
    const splitSource = {
      ...source,
      syllable: '가',
      sourcePath: 'M0 0 L2 0 Z',
      contours: [
        {
          id: 0,
          d: 'M0 0 L2 0 Z',
          commands: [
            { type: 'M' as const, x: 0, y: 0 },
            { type: 'L' as const, x: 2, y: 0 },
            { type: 'Z' as const },
          ],
          commandHash: 'split',
          bounds: { x1: 0, y1: 0, x2: 2, y2: 0 },
          commandTypes: 'MLZ',
        },
      ],
      physicalSteps: [
        { order: 0, jamo: 'ㄱ', slot: 'choseong' as const },
        { order: 1, jamo: 'ㅏ', slot: 'jungseong' as const },
      ],
    }
    const splitReview: GlyphReview = {
      ...review,
      syllable: '가',
      source: {
        extraction: splitSource.extraction,
        sourceGlyphHash: splitSource.sourceGlyphHash,
      },
      steps: [
        {
          order: 0,
          jamo: 'ㄱ',
          geometry: [
            { kind: 'split-piece', recipeId: 'partition', pieceId: 'one' },
          ],
        },
        {
          order: 1,
          jamo: 'ㅏ',
          geometry: [
            { kind: 'split-piece', recipeId: 'partition', pieceId: 'two' },
          ],
        },
      ],
      splitRecipes: [
        {
          splitRecipeSchemaVersion: 2,
          id: 'partition',
          sourceContourId: 0,
          sourceContourHash: 'split',
          method: 'source-command-partition',
          rationale: 'test',
          visualValidation: { sourceContourHash: 'split' },
          pieces: [
            {
              id: 'one',
              tokens: [{ kind: 'source-range', fromCommand: 0, toCommand: 0 }],
            },
            {
              id: 'two',
              tokens: [
                {
                  kind: 'move-to-anchor',
                  anchor: { contourId: 0, commandIndex: 0, point: 'end' },
                },
                { kind: 'source-range', fromCommand: 1, toCommand: 2 },
              ],
            },
          ],
        },
      ],
    }

    expect(validateReview(splitSource, splitReview).blockers).not.toContain(
      'invalid-split-recipe',
    )
  })
})
