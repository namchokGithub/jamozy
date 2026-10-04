import { describe, expect, test } from 'vitest'
import { auditReviews, pathContains } from './audit'
import { yeoCounterSplit } from './counter-split.fixture'
import { extractGlyph } from './extract'
import type { CachedGlyph, GlyphReview } from './types'

const wholeReview = (glyph: CachedGlyph, owners: number[][]): GlyphReview => ({
  reviewSchemaVersion: 2,
  syllable: glyph.syllable,
  source: {
    extraction: glyph.extraction,
    sourceGlyphHash: glyph.sourceGlyphHash,
  },
  status: 'approved',
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
const kinds = (findings: Array<{ check: string }>) =>
  findings.map(({ check }) => check)

describe('approved review audit', () => {
  test('even-odd containment honours counters', () => {
    const square = 'M0 0 L100 0 L100 100 L0 100 Z M25 25 L75 25 L75 75 L25 75 Z'
    expect(pathContains(square, 10, 50)).toBe(true)
    expect(pathContains(square, 50, 50)).toBe(false)
  })

  test('reports nothing for correct reviews', async () => {
    const ga = await extractGlyph('가')
    const yeo = await extractGlyph('여')
    expect(
      auditReviews([
        { glyph: ga, review: wholeReview(ga, [[1], [0]]) },
        { glyph: yeo, review: yeoCounterSplit(yeo, 'approved') },
      ]),
    ).toEqual([])
  })

  test('flags a vowel that sits on the wrong side of the initial', async () => {
    // 니 c0 is the right-hand ㅣ stem; giving it to ㄴ swaps the jamo.
    const ni = await extractGlyph('니')
    expect(
      kinds(auditReviews([{ glyph: ni, review: wholeReview(ni, [[0], [1]]) }])),
    ).toContain('position')
  })

  test('flags a review that disagrees with a similar approved glyph', async () => {
    const ni = await extractGlyph('니')
    const di = await extractGlyph('디')
    const findings = auditReviews([
      { glyph: ni, review: wholeReview(ni, [[0], [1]]) },
      { glyph: di, review: wholeReview(di, [[1], [0]]) },
    ])
    expect(findings).toContainEqual(
      expect.objectContaining({ syllable: '니', check: 'similar-glyph' }),
    )
  })

  test('flags a validation blocker', async () => {
    const ga = await extractGlyph('가')
    expect(
      kinds(auditReviews([{ glyph: ga, review: wholeReview(ga, [[1], []]) }])),
    ).toContain('validation')
  })
})
