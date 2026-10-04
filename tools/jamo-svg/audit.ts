import { compileReview, validateReview } from './compile'
import { pathContains } from './geometry'
import { proposeReview, type ApprovedTemplate } from './propose'
import type { Bounds, GlyphReview } from './types'

export type AuditCheck =
  'validation' | 'position' | 'tiny-step' | 'similar-glyph'
export type AuditFinding = {
  syllable: string
  check: AuditCheck
  detail: string
}

/** Steps smaller than this (font units², bounding box) are likely leftover slivers. */
const TINY_STEP_AREA = 20_000
/** How close an approved twin must be for the similar-glyph cross-check. */
const SIMILAR_MAX_COST = 250
const VERTICAL_MEDIALS = new Set('ㅏㅐㅑㅒㅓㅔㅕㅖㅣ')
const HORIZONTAL_MEDIALS = new Set('ㅗㅛㅜㅠㅡ')

const pathBounds = (d: string): Bounds => {
  const values = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
  const xs = values.filter((_, index) => index % 2 === 0)
  const ys = values.filter((_, index) => index % 2 === 1)
  return {
    x1: Math.min(...xs),
    y1: Math.min(...ys),
    x2: Math.max(...xs),
    y2: Math.max(...ys),
  }
}
const center = (bounds: Bounds) => ({
  x: (bounds.x1 + bounds.x2) / 2,
  y: (bounds.y1 + bounds.y2) / 2,
})
const ownership = (review: GlyphReview) =>
  review.steps
    .map((step) =>
      step.geometry
        .map((ref) =>
          ref.kind === 'contour' ? `c${ref.contourId}` : ref.pieceId,
        )
        .sort()
        .join(','),
    )
    .join(' / ')

/**
 * Audits approved reviews for mistakes validation cannot see: blockers that
 * appeared later, jamo on the wrong side of the initial, sliver steps,
 * and disagreement with a similar approved glyph. Counters inside a split
 * outline are checked by validation (`counter-owner-mismatch`).
 */
export { pathContains }

export function auditReviews(reviews: ApprovedTemplate[]): AuditFinding[] {
  const findings: AuditFinding[] = []
  for (const item of reviews) {
    const { glyph, review } = item
    const report = (check: AuditCheck, detail: string) =>
      findings.push({ syllable: glyph.syllable, check, detail })
    const blockers = validateReview(glyph, review).blockers
    if (blockers.length) {
      report('validation', blockers.join(', '))
      continue
    }
    const paths = compileReview(glyph, review).paths.map((path, order) => ({
      ...path,
      slot: glyph.physicalSteps[order].slot,
      bounds: pathBounds(path.d),
    }))
    const initial = paths.find(({ slot }) => slot === 'choseong')
    for (const path of paths) {
      if (!initial || path === initial) continue
      const here = center(path.bounds)
      const anchor = center(initial.bounds)
      if (
        path.slot === 'jungseong' &&
        VERTICAL_MEDIALS.has(path.jamo) &&
        here.x <= anchor.x
      )
        report('position', `${path.jamo} is not right of ${initial.jamo}`)
      if (
        path.slot === 'jungseong' &&
        HORIZONTAL_MEDIALS.has(path.jamo) &&
        here.y <= anchor.y
      )
        report('position', `${path.jamo} is not below ${initial.jamo}`)
      if (path.slot === 'jongseong' && here.y <= anchor.y)
        report('position', `final ${path.jamo} is not below ${initial.jamo}`)
    }
    for (const path of paths)
      if (
        (path.bounds.x2 - path.bounds.x1) * (path.bounds.y2 - path.bounds.y1) <
        TINY_STEP_AREA
      )
        report(
          'tiny-step',
          `${path.jamo} is only ${Math.round(path.bounds.x2 - path.bounds.x1)}×${Math.round(path.bounds.y2 - path.bounds.y1)}`,
        )
    if (!review.splitRecipes.length) {
      const twin = proposeReview(
        glyph,
        reviews.filter(
          (other) => other !== item && !other.review.splitRecipes.length,
        ),
        SIMILAR_MAX_COST,
      )
      if (twin && ownership(twin.review) !== ownership(review))
        report(
          'similar-glyph',
          `${ownership(review)} differs from ${twin.templateSyllable}'s pattern ${ownership(twin.review)}`,
        )
    }
  }
  return findings
}
