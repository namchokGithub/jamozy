import { describe, expect, test } from 'vitest'
import { extractGlyph } from './extract'
import { matchContours, proposeReview, rankTemplateCandidates, type ApprovedTemplate } from './propose'
import { seedReview } from './seed'
import { yeoCounterSplit } from './counter-split.fixture'
import type { CachedGlyph, GlyphReview } from './types'

const approved = (
  glyph: CachedGlyph,
  owners: number[][],
): ApprovedTemplate => ({
  glyph,
  review: {
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
  } satisfies GlyphReview,
})
const owners = (review: GlyphReview) =>
  review.steps.map((step) =>
    step.geometry
      .map((ref) => (ref.kind === 'contour' ? ref.contourId : -1))
      .sort(),
  )

describe('approved-template proposals', () => {
  test('matches contours by bounds regardless of contour order', () => {
    const a = { x1: 0, y1: 0, x2: 100, y2: 100 }
    const b = { x1: 500, y1: 0, x2: 600, y2: 900 }
    expect(matchContours([b, a], [a, { ...b, x2: 610 }])).toEqual({
      pairs: [1, 0],
      cost: 10,
    })
    expect(matchContours([a], [a, b])).toBeUndefined()
  })

  test('copies step ownership from the closest approved glyph as proposed', async () => {
    const template = approved(await extractGlyph('가'), [[1], [0]])
    const proposal = proposeReview(await extractGlyph('나'), [template], 250)
    expect(proposal).toMatchObject({
      templateSyllable: '가',
      review: { syllable: '나', status: 'proposed', blockers: [] },
    })
    expect(owners(proposal!.review)).toEqual([[1], [0]])
  })

  test('rejects templates that are too far away', async () => {
    const template = approved(await extractGlyph('가'), [[1], [0]])
    expect(
      proposeReview(await extractGlyph('나'), [template], 1),
    ).toBeUndefined()
  })

  test('never proposes ownership that paints a counter as another jamo', async () => {
    // 너 has the same contour count as 어, whose ㅇ+ㅓ outline encloses a counter.
    const template = approved(await extractGlyph('너'), [[1], [0]])
    expect(
      proposeReview(await extractGlyph('어'), [template], 10_000),
    ).toBeUndefined()
  })

  test('only uses templates with the same medial vowel', async () => {
    const template = approved(await extractGlyph('가'), [[1], [0]])
    expect(
      proposeReview(await extractGlyph('너'), [template], 10_000),
    ).toBeUndefined()
  })

  describe('split recipe transfer', () => {
    // A renamed copy of 값 stands in for a glyph with the same contour structure.
    const sameShapeAs = async (
      syllable: string,
      edit?: (glyph: CachedGlyph) => void,
    ) => {
      const glyph = structuredClone(await extractGlyph(syllable))
      glyph.syllable = '갔'
      edit?.(glyph)
      return glyph
    }
    const valuesTemplate = async (): Promise<ApprovedTemplate> => ({
      glyph: await extractGlyph('값'),
      review: { ...(await seedReview('값')), status: 'approved' },
    })

    test('re-targets the recipe and its piece ownership onto the matched contour', async () => {
      const template = await valuesTemplate()
      const proposal = proposeReview(await sameShapeAs('값'), [template], 250)
      expect(proposal?.review.splitRecipes).toHaveLength(1)
      expect(proposal?.review.splitRecipes[0]).toMatchObject({
        sourceContourId: 2,
        pieces: template.review.splitRecipes[0].pieces,
      })
      const refs = (review: GlyphReview) =>
        review.steps.map((step) =>
          step.geometry.map((ref) => JSON.stringify(ref)).sort(),
        )
      expect(refs(proposal!.review)).toEqual(refs(template.review))
    })

    test('rejects a recipe whose contour has a different command shape', async () => {
      const target = await sameShapeAs('값', (glyph) => {
        glyph.contours[2].commandTypes += 'L'
      })
      expect(
        proposeReview(target, [await valuesTemplate()], 250),
      ).toBeUndefined()
    })

    test('rejects a recipe whose command points moved beyond the cost limit', async () => {
      const target = await sameShapeAs('값', (glyph) => {
        const contour = glyph.contours[2]
        const command = contour.commands.find(
          (item, index) => index > 0 && item.x !== undefined,
        )!
        command.x =
          command.x! < (contour.bounds.x1 + contour.bounds.x2) / 2
            ? contour.bounds.x2
            : contour.bounds.x1
      })
      expect(
        proposeReview(target, [await valuesTemplate()], 250),
      ).toBeUndefined()
    })
    const yeoTemplate = async (): Promise<ApprovedTemplate> => {
      const glyph = await extractGlyph('여')
      return { glyph, review: yeoCounterSplit(glyph, 'approved') }
    }
    const renamedYeo = async (edit?: (glyph: CachedGlyph) => void) => {
      const glyph = structuredClone(await extractGlyph('여'))
      glyph.syllable = '혀'
      edit?.(glyph)
      return glyph
    }

    test('re-targets a counter recipe onto the matched outline and counter', async () => {
      const proposal = proposeReview(
        await renamedYeo(),
        [await yeoTemplate()],
        250,
      )
      expect(proposal?.review.splitRecipes[0].counterContours).toEqual([
        {
          contourId: 2,
          contourHash: (await extractGlyph('여')).contours[2].commandHash,
        },
      ])
      expect(proposal?.review.blockers).toEqual([])
      // An identical target keeps every range and anchor on its original contour.
      expect(proposal?.review.splitRecipes[0].pieces).toEqual((await yeoTemplate()).review.splitRecipes[0].pieces)
    })

    test('rejects a counter recipe when the counter has a different command shape', async () => {
      const target = await renamedYeo((glyph) => {
        glyph.contours[2].commandTypes += 'L'
      })
      expect(proposeReview(target, [await yeoTemplate()], 250)).toBeUndefined()
    })
  })
})

describe('rankTemplateCandidates', () => {
  test('groups each unreviewed glyph under the one whose approval would propose the most others', async () => {
    const glyphs = await Promise.all(['가', '카', '나', '거'].map((syllable) => extractGlyph(syllable)))
    const groups = rankTemplateCandidates(glyphs, 10_000)
    // Only 가/카/나 share a vowel and step count; 거 has a different vowel.
    expect(groups).toHaveLength(1)
    expect([groups[0].template, ...groups[0].proposes].sort()).toEqual(['가', '나', '카'])
  })

  test('returns no group when nothing is within the cost limit', async () => {
    const glyphs = await Promise.all(['가', '나'].map((syllable) => extractGlyph(syllable)))
    expect(rankTemplateCandidates(glyphs, 1)).toEqual([])
  })
})
