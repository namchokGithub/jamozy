import { describe, expect, test } from 'vitest'
import { extractGlyph } from './extract'
import { matchContours, proposeReview, type ApprovedTemplate } from './propose'
import type { CachedGlyph, GlyphReview } from './types'

const approved = (glyph: CachedGlyph, owners: number[][]): ApprovedTemplate => ({
  glyph,
  review: {
    reviewSchemaVersion: 2,
    syllable: glyph.syllable,
    source: { extraction: glyph.extraction, sourceGlyphHash: glyph.sourceGlyphHash },
    status: 'approved',
    blockers: [],
    steps: glyph.physicalSteps.map(({ order, jamo }) => ({ order, jamo, geometry: owners[order].map((contourId) => ({ kind: 'contour' as const, contourId })) })),
    splitRecipes: [],
  } satisfies GlyphReview,
})
const owners = (review: GlyphReview) => review.steps.map((step) => step.geometry.map((ref) => (ref.kind === 'contour' ? ref.contourId : -1)).sort())

describe('approved-template proposals', () => {
  test('matches contours by bounds regardless of contour order', () => {
    const a = { x1: 0, y1: 0, x2: 100, y2: 100 }; const b = { x1: 500, y1: 0, x2: 600, y2: 900 }
    expect(matchContours([b, a], [a, { ...b, x2: 610 }])).toEqual({ pairs: [1, 0], cost: 10 })
    expect(matchContours([a], [a, b])).toBeUndefined()
  })

  test('copies step ownership from the closest approved glyph as proposed', async () => {
    const template = approved(await extractGlyph('가'), [[1], [0]])
    const proposal = proposeReview(await extractGlyph('나'), [template], 250)
    expect(proposal).toMatchObject({ templateSyllable: '가', review: { syllable: '나', status: 'proposed', blockers: [] } })
    expect(owners(proposal!.review)).toEqual([[1], [0]])
  })

  test('rejects templates that are too far away', async () => {
    const template = approved(await extractGlyph('가'), [[1], [0]])
    expect(proposeReview(await extractGlyph('나'), [template], 1)).toBeUndefined()
  })

  test('never proposes ownership that paints a counter as another jamo', async () => {
    // 너 has the same contour count as 어, whose ㅇ+ㅓ outline encloses a counter.
    const template = approved(await extractGlyph('너'), [[1], [0]])
    expect(proposeReview(await extractGlyph('어'), [template], 10_000)).toBeUndefined()
  })
})
