import { describe, expect, test } from 'vitest'
import {
  compileReview,
  counterContours,
  validateReview,
  type CachedGlyph,
  type GlyphReview,
} from './compile'
import { yeoCounterSplit } from './counter-split.fixture'
import { extractGlyph } from './extract'

const source: CachedGlyph = {
  syllable: '하',
  sourceGlyphHash: 'source-hash',
  extraction: {
    fontSha256: 'font-hash',
    extractionSchema: 1,
    pathNormalization: 1,
    physicalStepAlgorithm: 3,
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

describe('counter ownership', () => {
  const reviewOf = (glyph: CachedGlyph, owners: number[][]): GlyphReview => ({
    reviewSchemaVersion: 2,
    syllable: glyph.syllable,
    source: {
      extraction: glyph.extraction,
      sourceGlyphHash: glyph.sourceGlyphHash,
    },
    status: 'reviewing',
    blockers: [],
    steps: glyph.physicalSteps.map(({ order, jamo }) => ({
      order,
      jamo,
      geometry: owners[order].map((contourId) => ({
        kind: 'contour' as const,
        contourId,
      })),
    })),
    splitRecipes: [],
  })

  test('pairs each counter with the outline that encloses it', async () => {
    expect(counterContours(await extractGlyph('방'))).toEqual([
      { counterId: 1, outerId: 0 },
      { counterId: 4, outerId: 3 },
    ])
    expect(counterContours(await extractGlyph('가'))).toEqual([])
  })

  test('accepts a counter owned with its enclosing outline', async () => {
    const glyph = await extractGlyph('아')
    expect(
      validateReview(glyph, reviewOf(glyph, [[0, 1], [2]])).blockers,
    ).toEqual([])
  })

  test.each([
    ['어', [[0], [1]]],
    ['중', [[2], [0], [1]]],
  ])(
    'blocks %s when its counter is painted as another jamo',
    async (syllable, owners) => {
      const glyph = await extractGlyph(syllable)
      expect(validateReview(glyph, reviewOf(glyph, owners)).blockers).toEqual([
        'counter-owner-mismatch',
      ])
    },
  )
})

describe('counter-aware split recipes', () => {
  const recipeOf = (review: GlyphReview) => review.splitRecipes[0]
  const withRecipe = (
    review: GlyphReview,
    edit: (recipe: GlyphReview['splitRecipes'][number]) => void,
  ) => {
    const next = structuredClone(review)
    edit(recipeOf(next))
    return next
  }

  test('accepts 여 partitioned with the counter between ㅇ and ㅕ', async () => {
    const glyph = await extractGlyph('여')
    expect(validateReview(glyph, yeoCounterSplit(glyph)).blockers).toEqual([])
  })

  test('rejects a counter whose hash is stale', async () => {
    const glyph = await extractGlyph('여')
    const review = withRecipe(yeoCounterSplit(glyph), (recipe) => {
      recipe.counterContours![0].contourHash = 'stale'
    })
    expect(validateReview(glyph, review).blockers).toContain(
      'invalid-split-recipe',
    )
  })

  test('rejects a declared contour that is not a counter of the source outline', async () => {
    // Only counters that counterContours() pairs with the source contour qualify;
    // the outline itself (or a counter of another outline, e.g. 영's c3 ⊂ c2) does not.
    const glyph = await extractGlyph('여')
    const review = withRecipe(yeoCounterSplit(glyph), (recipe) => {
      recipe.counterContours = [
        ...recipe.counterContours!,
        { contourId: 0, contourHash: glyph.contours[0].commandHash },
      ]
    })
    expect(validateReview(glyph, review).blockers).toContain(
      'invalid-split-recipe',
    )
    expect(counterContours(await extractGlyph('영'))).toContainEqual({
      counterId: 3,
      outerId: 2,
    })
  })

  test('rejects a counter range that consumes the counter M command', async () => {
    const glyph = await extractGlyph('여')
    const review = withRecipe(yeoCounterSplit(glyph), (recipe) => {
      recipe.pieces[0].tokens[2] = {
        kind: 'source-range',
        contourId: 2,
        fromCommand: 0,
        toCommand: 3,
      }
    })
    expect(validateReview(glyph, review).blockers).toContain(
      'invalid-split-recipe',
    )
  })

  test('rejects a counter whose commands are not all consumed exactly once', async () => {
    const glyph = await extractGlyph('여')
    const review = withRecipe(yeoCounterSplit(glyph), (recipe) => {
      recipe.pieces[1].tokens[2] = {
        kind: 'source-range',
        contourId: 2,
        fromCommand: 4,
        toCommand: 6,
      }
    })
    expect(validateReview(glyph, review).blockers).toContain(
      'invalid-split-recipe',
    )
  })

  test('rejects a range on a contour the recipe did not declare', async () => {
    const glyph = await extractGlyph('여')
    const review = withRecipe(yeoCounterSplit(glyph), (recipe) => {
      recipe.counterContours = []
    })
    expect(validateReview(glyph, review).blockers).toContain(
      'invalid-split-recipe',
    )
  })

  test('rejects a close-to-start seam before the end of a piece', async () => {
    // A mid-piece close jumps back to the piece start and silently opens a new subpath.
    const glyph = await extractGlyph('여')
    const review = withRecipe(yeoCounterSplit(glyph), (recipe) => {
      recipe.pieces[1].tokens.splice(1, 0, {
        kind: 'close-to-start',
        reason: 'interior-closure-seam',
      })
    })
    expect(validateReview(glyph, review).blockers).toContain(
      'invalid-split-recipe',
    )
  })

  test('reports a consumed counter that is also split by a second recipe', async () => {
    const glyph = await extractGlyph('여')
    const review = yeoCounterSplit(glyph)
    const gap = glyph.contours[2]
    review.splitRecipes.push({
      splitRecipeSchemaVersion: 2,
      id: 'gap-again',
      sourceContourId: 2,
      sourceContourHash: gap.commandHash,
      method: 'source-command-partition',
      rationale: 'Second claim on the consumed counter.',
      visualValidation: { sourceContourHash: gap.commandHash },
      pieces: [
        {
          id: 'all',
          tokens: [{ kind: 'source-range', fromCommand: 0, toCommand: 7 }],
        },
      ],
    })
    review.steps[1].geometry.push({
      kind: 'split-piece',
      recipeId: 'gap-again',
      pieceId: 'all',
    })
    expect(validateReview(glyph, review).blockers).toContain(
      'duplicate-ownership',
    )
  })

  test('reports a consumed counter that is also assigned whole', async () => {
    const glyph = await extractGlyph('여')
    const review = yeoCounterSplit(glyph)
    review.steps[1].geometry.push({ kind: 'contour', contourId: 2 })
    expect(validateReview(glyph, review).blockers).toContain(
      'duplicate-ownership',
    )
  })

  // Even-odd containment over the compiled on-curve points of every subpath.
  const contains = (d: string, x: number, y: number) =>
    d
      .split('M')
      .filter(Boolean)
      .reduce((inside, subpath) => {
        // Q commands list the control point first; keep only on-curve endpoints.
        const onCurve = subpath.split(/(?=[LQZ])/).flatMap((part) => {
          const values = (part.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
          return values.length >= 2
            ? [[values.at(-2)!, values.at(-1)!] as [number, number]]
            : []
        })
        let crossings = 0
        onCurve.forEach(([px, py], index) => {
          const [qx, qy] =
            onCurve[(index + onCurve.length - 1) % onCurve.length]
          if (py > y !== qy > y && x < ((qx - px) * (y - py)) / (qy - py) + px)
            crossings += 1
        })
        return crossings % 2 === 1 ? !inside : inside
      }, false)

  test('gives the crescent left of the counter curve to ㅇ, not ㅕ', async () => {
    const glyph = await extractGlyph('여')
    const [ieung, yeo] = compileReview(glyph, yeoCounterSplit(glyph)).paths
    // (975, 900) lies between the straight seam (x≈940) and the counter's curve (x≈1010).
    expect(contains(ieung.d, 975, 900)).toBe(true)
    expect(contains(yeo.d, 975, 900)).toBe(false)
    // The counter interior stays empty for both.
    expect(contains(ieung.d, 1200, 900)).toBe(false)
    expect(contains(yeo.d, 1200, 900)).toBe(false)
    expect(contains(yeo.d, 1466, 900)).toBe(true)
  })
})
