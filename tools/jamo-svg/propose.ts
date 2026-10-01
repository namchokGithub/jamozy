import { validateReview } from './compile'
import type { Bounds, CachedGlyph, GlyphReview } from './types'

export type ApprovedTemplate = { glyph: CachedGlyph; review: GlyphReview }
export type Proposal = { review: GlyphReview; templateSyllable: string; cost: number }

/** Largest edge displacement, in font units, between two contour bounds. */
const boundsDistance = (a: Bounds, b: Bounds) =>
  Math.max(Math.abs(a.x1 - b.x1), Math.abs(a.y1 - b.y1), Math.abs(a.x2 - b.x2), Math.abs(a.y2 - b.y2))

/**
 * Pairs every target contour with a distinct template contour, minimising the
 * worst pair distance (ties broken by the total). Contour counts are small, so
 * an exact bitmask search is cheap.
 */
export function matchContours(target: Bounds[], template: Bounds[]): { pairs: number[]; cost: number } | undefined {
  const n = target.length
  if (n !== template.length || n === 0 || n > 12) return undefined
  type Best = { worst: number; total: number; pairs: number[] }
  const memo = new Map<number, Best>()
  const solve = (index: number, used: number): Best => {
    if (index === n) return { worst: 0, total: 0, pairs: [] }
    const cached = memo.get(used); if (cached) return cached
    let best: Best = { worst: Infinity, total: Infinity, pairs: [] }
    for (let candidate = 0; candidate < n; candidate += 1) {
      if (used & (1 << candidate)) continue
      const distance = boundsDistance(target[index], template[candidate])
      const rest = solve(index + 1, used | (1 << candidate))
      const worst = Math.max(distance, rest.worst); const total = distance + rest.total
      if (worst < best.worst || (worst === best.worst && total < best.total)) best = { worst, total, pairs: [candidate, ...rest.pairs] }
    }
    memo.set(used, best); return best
  }
  const best = solve(0, 0)
  return { pairs: best.pairs, cost: best.worst }
}

const usesWholeContoursOnly = (review: GlyphReview) =>
  review.splitRecipes.length === 0 && review.steps.every((step) => step.geometry.every((ref) => ref.kind === 'contour'))

/**
 * Proposes whole-contour ownership for `target` by copying the step owners of
 * the closest approved glyph with the same physical-step shape. A proposal is
 * returned only when every contour lands within `maxCost` font units of its
 * template contour and the result passes `validateReview` without blockers.
 */
export function proposeReview(target: CachedGlyph, templates: ApprovedTemplate[], maxCost: number): Proposal | undefined {
  const candidates = templates.flatMap(({ glyph, review }) => {
    if (glyph.syllable === target.syllable || review.status !== 'approved' || !usesWholeContoursOnly(review)) return []
    if (glyph.physicalSteps.length !== target.physicalSteps.length || glyph.hangul.medialLayout !== target.hangul.medialLayout) return []
    const match = matchContours(target.contours.map(({ bounds }) => bounds), glyph.contours.map(({ bounds }) => bounds))
    return match && match.cost <= maxCost ? [{ glyph, review, match }] : []
  }).sort((a, b) => a.match.cost - b.match.cost || a.glyph.syllable.localeCompare(b.glyph.syllable))
  for (const { glyph, review, match } of candidates) {
    const ownerOf = new Map(review.steps.flatMap((step) => step.geometry.flatMap((ref) => (ref.kind === 'contour' ? [[ref.contourId, step.order] as const] : []))))
    const proposal: GlyphReview = {
      reviewSchemaVersion: 2,
      syllable: target.syllable,
      source: { extraction: target.extraction, sourceGlyphHash: target.sourceGlyphHash },
      status: 'proposed',
      blockers: [],
      steps: target.physicalSteps.map(({ order, jamo }) => ({
        order,
        jamo,
        geometry: target.contours.filter((_, index) => ownerOf.get(glyph.contours[match.pairs[index]].id) === order).map((contour) => ({ kind: 'contour' as const, contourId: contour.id })),
      })),
      splitRecipes: [],
    }
    if (validateReview(target, proposal).blockers.length === 0) return { review: proposal, templateSyllable: glyph.syllable, cost: match.cost }
  }
  return undefined
}
