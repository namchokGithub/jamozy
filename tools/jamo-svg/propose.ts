import { validateReview } from './compile'
import type {
  Bounds,
  CachedGlyph,
  GlyphReview,
  RecipeToken,
  SplitRecipe,
} from './types'

export type ApprovedTemplate = { glyph: CachedGlyph; review: GlyphReview }
export type Proposal = {
  review: GlyphReview
  templateSyllable: string
  cost: number
}

/** Largest edge displacement, in font units, between two contour bounds. */
const boundsDistance = (a: Bounds, b: Bounds) =>
  Math.max(
    Math.abs(a.x1 - b.x1),
    Math.abs(a.y1 - b.y1),
    Math.abs(a.x2 - b.x2),
    Math.abs(a.y2 - b.y2),
  )

/**
 * Pairs every target contour with a distinct template contour, minimising the
 * worst pair distance (ties broken by the total). Contour counts are small, so
 * an exact bitmask search is cheap.
 */
export function matchContours(
  target: Bounds[],
  template: Bounds[],
): { pairs: number[]; cost: number } | undefined {
  const n = target.length
  if (n !== template.length || n === 0 || n > 12) return undefined
  type Best = { worst: number; total: number; pairs: number[] }
  const memo = new Map<number, Best>()
  const solve = (index: number, used: number): Best => {
    if (index === n) return { worst: 0, total: 0, pairs: [] }
    const cached = memo.get(used)
    if (cached) return cached
    let best: Best = { worst: Infinity, total: Infinity, pairs: [] }
    for (let candidate = 0; candidate < n; candidate += 1) {
      if (used & (1 << candidate)) continue
      const distance = boundsDistance(target[index], template[candidate])
      const rest = solve(index + 1, used | (1 << candidate))
      const worst = Math.max(distance, rest.worst)
      const total = distance + rest.total
      if (worst < best.worst || (worst === best.worst && total < best.total))
        best = { worst, total, pairs: [candidate, ...rest.pairs] }
    }
    memo.set(used, best)
    return best
  }
  const best = solve(0, 0)
  return { pairs: best.pairs, cost: best.worst }
}

/**
 * Re-targets a template's split recipes onto the matched target contours. A
 * recipe transfers only when the target contour has exactly the same command
 * sequence shape, so every command index and anchor keeps its meaning.
 */
/** Largest distance between corresponding on-curve points of two contours. */
const pointDistance = (
  a: CachedGlyph['contours'][number],
  b: CachedGlyph['contours'][number],
) =>
  a.commands.reduce((worst, command, index) => {
    const other = b.commands[index]
    if (
      command.x === undefined ||
      command.y === undefined ||
      other?.x === undefined ||
      other.y === undefined
    )
      return worst
    return Math.max(
      worst,
      Math.abs(command.x - other.x),
      Math.abs(command.y - other.y),
    )
  }, 0)

function transferRecipes(
  target: CachedGlyph,
  template: CachedGlyph,
  review: GlyphReview,
  targetIndexOf: Map<number, number>,
  maxCost: number,
): SplitRecipe[] | undefined {
  const recipes: SplitRecipe[] = []
  for (const recipe of review.splitRecipes) {
    const matched = (templateId: number) => {
      const from = template.contours.find(({ id }) => id === templateId)
      const index = from && targetIndexOf.get(template.contours.indexOf(from))
      const to = index === undefined ? undefined : target.contours[index]
      // Same command shape is not enough: a contour can start elsewhere or bend
      // differently, so every command must also land near its template point.
      return from &&
        to &&
        to.commandTypes === from.commandTypes &&
        to.commands.length === from.commands.length &&
        pointDistance(to, from) <= maxCost
        ? { from, to }
        : undefined
    }
    const source = matched(recipe.sourceContourId)
    const counters = (recipe.counterContours ?? []).map(({ contourId }) =>
      matched(contourId),
    )
    if (!source || counters.some((counter) => !counter)) return undefined
    const idOf = new Map([
      [source.from.id, source.to.id],
      ...counters.map((counter) => [counter!.from.id, counter!.to.id] as const),
    ])
    const retarget = (id: number) => idOf.get(id) ?? source.to.id
    recipes.push({
      ...recipe,
      sourceContourId: source.to.id,
      sourceContourHash: source.to.commandHash,
      ...(recipe.counterContours
        ? {
            counterContours: counters.map((counter) => ({
              contourId: counter!.to.id,
              contourHash: counter!.to.commandHash,
            })),
          }
        : {}),
      visualValidation: { sourceContourHash: source.to.commandHash },
      rationale: `Proposed from ${template.syllable}: ${recipe.rationale}`,
      pieces: recipe.pieces.map((piece) => ({
        ...piece,
        tokens: piece.tokens.map((token): RecipeToken =>
          token.kind === 'move-to-anchor' || token.kind === 'line-to-anchor'
            ? {
                ...token,
                anchor: {
                  ...token.anchor,
                  contourId: retarget(token.anchor.contourId),
                },
              }
            : token.kind === 'source-range' && token.contourId !== undefined
              ? { ...token, contourId: retarget(token.contourId) }
              : token,
        ),
      })),
    })
  }
  return recipes
}

/**
 * Proposes ownership for `target` by copying the step owners of the closest
 * approved glyph with the same physical-step shape, including its split
 * recipes where the matched contours share a command structure. A proposal is
 * returned only when every contour lands within `maxCost` font units of its
 * template contour and the result passes `validateReview` without blockers.
 */
export function proposeReview(
  target: CachedGlyph,
  templates: ApprovedTemplate[],
  maxCost: number,
): Proposal | undefined {
  const candidates = templates
    .flatMap(({ glyph, review }) => {
      if (glyph.syllable === target.syllable || review.status !== 'approved')
        return []
      // The medial decides how strokes join the initial and final; a different
      // vowel with similar bounds (게 from 키) can hide a union contour.
      if (
        glyph.physicalSteps.length !== target.physicalSteps.length ||
        glyph.hangul.jungseong !== target.hangul.jungseong
      )
        return []
      const match = matchContours(
        target.contours.map(({ bounds }) => bounds),
        glyph.contours.map(({ bounds }) => bounds),
      )
      return match && match.cost <= maxCost ? [{ glyph, review, match }] : []
    })
    .sort(
      (a, b) =>
        a.match.cost - b.match.cost ||
        a.glyph.syllable.localeCompare(b.glyph.syllable),
    )
  for (const { glyph, review, match } of candidates) {
    // match.pairs[targetIndex] = templateIndex; invert it for recipe transfer.
    const targetIndexOf = new Map(
      match.pairs.map((templateIndex, targetIndex) => [
        templateIndex,
        targetIndex,
      ]),
    )
    const splitRecipes = transferRecipes(
      target,
      glyph,
      review,
      targetIndexOf,
      maxCost,
    )
    if (!splitRecipes) continue
    const recipeIdFor = new Map(
      review.splitRecipes.map((recipe, index) => [
        recipe.id,
        splitRecipes[index].id,
      ]),
    )
    const ownerOf = new Map(
      review.steps.flatMap((step) =>
        step.geometry.flatMap((ref) =>
          ref.kind === 'contour' ? [[ref.contourId, step.order] as const] : [],
        ),
      ),
    )
    const proposal: GlyphReview = {
      reviewSchemaVersion: 2,
      syllable: target.syllable,
      source: {
        extraction: target.extraction,
        sourceGlyphHash: target.sourceGlyphHash,
      },
      status: 'proposed',
      blockers: [],
      steps: target.physicalSteps.map(({ order, jamo }) => ({
        order,
        jamo,
        geometry: [
          ...target.contours
            .filter(
              (_, index) =>
                ownerOf.get(glyph.contours[match.pairs[index]].id) === order,
            )
            .map((contour) => ({
              kind: 'contour' as const,
              contourId: contour.id,
            })),
          ...(review.steps[order]?.geometry ?? []).flatMap((ref) =>
            ref.kind === 'split-piece'
              ? [
                  {
                    ...ref,
                    recipeId: recipeIdFor.get(ref.recipeId) ?? ref.recipeId,
                  },
                ]
              : [],
          ),
        ],
      })),
      splitRecipes,
    }
    if (validateReview(target, proposal).blockers.length === 0)
      return {
        review: proposal,
        templateSyllable: glyph.syllable,
        cost: match.cost,
      }
  }
  return undefined
}
