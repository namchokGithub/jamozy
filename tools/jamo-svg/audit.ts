import { compileReview, counterContours, validateReview } from './compile'
import { proposeReview, type ApprovedTemplate } from './propose'
import type { Bounds, GlyphReview } from './types'

export type AuditCheck =
  'validation' | 'position' | 'tiny-step' | 'similar-glyph' | 'counter-ink'
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

const onCurvePoints = (subpath: string) =>
  subpath.split(/(?=[LQCZ])/).flatMap((part) => {
    const values = (part.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
    return values.length >= 2 ? [[values.at(-2)!, values.at(-1)!] as const] : []
  })

/** Even-odd containment over each subpath's on-curve points; enough for ownership probes. */
export function pathContains(d: string, x: number, y: number) {
  return d
    .split('M')
    .filter(Boolean)
    .reduce((inside, subpath) => {
      const points = onCurvePoints(subpath)
      let crossings = 0
      points.forEach(([px, py], index) => {
        const [qx, qy] = points[(index + points.length - 1) % points.length]
        if (py > y !== qy > y && x < ((qx - px) * (y - py)) / (qy - py) + px)
          crossings += 1
      })
      return crossings % 2 === 1 ? !inside : inside
    }, false)
}

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
 * disagreement with a similar approved glyph, and counters inside a split
 * outline owned by a different step than the ink around them.
 */
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
    const split = new Set(
      review.splitRecipes.map(({ sourceContourId }) => sourceContourId),
    )
    for (const { counterId, outerId } of counterContours(glyph)) {
      if (!split.has(outerId)) continue
      const owner = review.steps.find((step) =>
        step.geometry.some(
          (ref) => ref.kind === 'contour' && ref.contourId === counterId,
        ),
      )
      if (!owner) continue
      // Ink just outside the counter on four sides should mostly belong to its owner.
      const { x1, y1, x2, y2 } = glyph.contours[counterId].bounds
      const margin = 25
      const probes = [
        [(x1 + x2) / 2, y1 - margin],
        [(x1 + x2) / 2, y2 + margin],
        [x1 - margin, (y1 + y2) / 2],
        [x2 + margin, (y1 + y2) / 2],
      ]
      const holders = probes.map(([x, y]) =>
        paths.findIndex((path) => pathContains(path.d, x, y)),
      )
      const inked = holders.filter((order) => order >= 0)
      if (
        inked.length &&
        inked.filter((order) => order === owner.order).length * 2 < inked.length
      )
        report(
          'counter-ink',
          `Contour ${counterId + 1} belongs to ${owner.jamo}, but the ink around it is ${holders.map((order) => (order < 0 ? '·' : paths[order].jamo)).join('')}`,
        )
    }
  }
  return findings
}
