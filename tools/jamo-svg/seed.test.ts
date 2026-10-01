import { describe, expect, test } from 'vitest'
import { compileReview, validateReview } from './compile'
import { extractGlyph } from './extract'
import { seedReview } from './seed'

describe('verified Tagger references', () => {
  test('keeps verified 하 contours 2–4 together under ㅎ and contour 1 under ㅏ', async () => {
    const source = await extractGlyph('하')
    const review = await seedReview('하')
    expect(review.steps).toEqual([
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
    ])
    expect(validateReview(source, review).blockers).toEqual([])
  })

  test('represents 값 as four ordered physical steps with a constrained split recipe', async () => {
    const source = await extractGlyph('값')
    const review = await seedReview('값')
    expect(compileReview(source, review).paths.map(({ jamo }) => jamo)).toEqual(
      ['ㄱ', 'ㅏ', 'ㅂ', 'ㅅ'],
    )
    expect(review.splitRecipes).toHaveLength(1)
    expect(validateReview(source, review).blockers).toEqual([])
  })

  test('splits 화 contour 1 so the ㅎ ring and cap stay under ㅎ and the ㅗ stem and bar form ㅗ', async () => {
    const source = await extractGlyph('화')
    const review = await seedReview('화')
    expect(review.steps).toEqual([
      {
        order: 0,
        jamo: 'ㅎ',
        geometry: [
          { kind: 'split-piece', recipeId: 'hieut-o-1', pieceId: 'hieut-ring' },
          { kind: 'contour', contourId: 2 },
          { kind: 'contour', contourId: 3 },
        ],
      },
      {
        order: 1,
        jamo: 'ㅗ',
        geometry: [
          { kind: 'split-piece', recipeId: 'hieut-o-1', pieceId: 'o-stem-bar' },
        ],
      },
      { order: 2, jamo: 'ㅏ', geometry: [{ kind: 'contour', contourId: 0 }] },
    ])
    expect(validateReview(source, review).blockers).toEqual([])
  })
})
