import {
  REVIEW_SCHEMA_VERSION,
  SPLIT_RECIPE_SCHEMA_VERSION,
  type CachedContour,
  type CachedGlyph,
  type CompiledGlyph,
  type GlyphReview,
  type ReviewBlocker,
  type SplitRecipe,
} from './types'
import { compileSplitPiecePreview } from './split-workbench'

export * from './types'

export function compileRecipePiece(
  source: CachedGlyph,
  recipe: SplitRecipe,
  pieceId: string,
): string {
  const contour = source.contours.find(
    ({ id }) => id === recipe.sourceContourId,
  )
  const piece = recipe.pieces.find(({ id }) => id === pieceId)
  if (!contour || !piece) throw new Error('Unknown split recipe piece.')
  const counters = (recipe.counterContours ?? []).flatMap(({ contourId }) =>
    source.contours.filter(({ id }) => id === contourId),
  )
  return compileSplitPiecePreview(contour, piece, counters)
}

export function compileReview(
  source: CachedGlyph,
  review: GlyphReview,
): CompiledGlyph {
  const recipeById = new Map(
    review.splitRecipes.map((recipe) => [recipe.id, recipe]),
  )
  return {
    width: source.advanceWidth,
    paths: review.steps.map((step) => ({
      jamo: step.jamo,
      d: step.geometry
        .map((ref) => {
          if (ref.kind === 'contour') {
            const contour = source.contours.find(
              ({ id }) => id === ref.contourId,
            )
            if (!contour) throw new Error(`Unknown contour ${ref.contourId}.`)
            return contour.d
          }
          const recipe = recipeById.get(ref.recipeId)
          if (!recipe) throw new Error(`Unknown split recipe ${ref.recipeId}.`)
          return compileRecipePiece(source, recipe, ref.pieceId)
        })
        .join(' '),
    })),
  }
}

function recipeIsValid(source: CachedGlyph, recipe: SplitRecipe): boolean {
  const contour = source.contours.find(
    ({ id }) => id === recipe.sourceContourId,
  )
  if (
    !contour ||
    recipe.splitRecipeSchemaVersion !== SPLIT_RECIPE_SCHEMA_VERSION ||
    contour.commandHash !== recipe.sourceContourHash
  )
    return false
  // A recipe may also partition counters that this outline encloses, so a
  // seam can follow a counter's edge. Their M command carries no geometry.
  const enclosed = new Set(
    counterContours(source)
      .filter(({ outerId }) => outerId === contour.id)
      .map(({ counterId }) => counterId),
  )
  const counters = new Map<number, CachedContour>()
  for (const declared of recipe.counterContours ?? []) {
    const counter = source.contours.find(({ id }) => id === declared.contourId)
    if (
      !counter ||
      !enclosed.has(counter.id) ||
      counter.commandHash !== declared.contourHash ||
      counters.has(counter.id)
    )
      return false
    counters.set(counter.id, counter)
  }
  const contourOf = (id = contour.id) =>
    id === contour.id ? contour : counters.get(id)
  const ids = new Set<string>()
  const coverage = new Map<string, number>()
  const consume = (id: number, index: number) =>
    coverage.set(`${id}:${index}`, (coverage.get(`${id}:${index}`) ?? 0) + 1)
  const anchorIsUsable = (
    target: CachedContour,
    index: number,
    point: 'start' | 'end' | 'control1' | 'control2',
  ) => {
    const command = target.commands[index]
    if (!command) return false
    if (point === 'control1')
      return command.x1 !== undefined && command.y1 !== undefined
    if (point === 'control2')
      return command.x2 !== undefined && command.y2 !== undefined
    return command.x !== undefined && command.y !== undefined
  }
  const valid = recipe.pieces.every((piece) => {
    if (ids.has(piece.id)) return false
    ids.add(piece.id)
    // A close-to-start seam ends the piece; any token after it would start a
    // separate, unintended subpath.
    if (
      piece.tokens.some(
        (token, index) =>
          token.kind === 'close-to-start' && index !== piece.tokens.length - 1,
      )
    )
      return false
    return piece.tokens.every((token) => {
      if (token.kind === 'source-range') {
        const target = contourOf(token.contourId)
        if (!target || (target !== contour && token.fromCommand < 1))
          return false
        if (
          token.fromCommand < 0 ||
          token.toCommand < token.fromCommand ||
          token.toCommand >= target.commands.length
        )
          return false
        for (
          let index = token.fromCommand;
          index <= token.toCommand;
          index += 1
        )
          consume(target.id, index)
        return true
      }
      if (token.kind === 'move-to-anchor' || token.kind === 'line-to-anchor') {
        const target = contourOf(token.anchor.contourId)
        return Boolean(
          target &&
          anchorIsUsable(target, token.anchor.commandIndex, token.anchor.point),
        )
      }
      return true
    })
  })
  return (
    valid &&
    contour.commands.every(
      (_, index) => coverage.get(`${contour.id}:${index}`) === 1,
    ) &&
    [...counters.values()].every((counter) =>
      counter.commands.every(
        (_, index) =>
          index === 0 || coverage.get(`${counter.id}:${index}`) === 1,
      ),
    )
  )
}

type Point = { x: number; y: number }
const outlinePoints = (contour: CachedGlyph['contours'][number]): Point[] =>
  contour.commands.flatMap((command) =>
    command.x === undefined || command.y === undefined
      ? []
      : [{ x: command.x, y: command.y }],
  )
const signedArea = (points: Point[]) =>
  points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]
    return sum + point.x * next.y - next.x * point.y
  }, 0) / 2
const containsPoint = (points: Point[], { x, y }: Point) =>
  points.reduce((inside, point, index) => {
    const previous = points[(index + points.length - 1) % points.length]
    return point.y > y !== previous.y > y &&
      x <
        ((previous.x - point.x) * (y - point.y)) / (previous.y - point.y) +
          point.x
      ? !inside
      : inside
  }, false)

/**
 * Pairs each counter (hole) contour with the innermost contour enclosing it.
 * A counter winds opposite to its enclosing outline. Outlines are
 * approximated by their on-curve points, which is sufficient for containment.
 */
export function counterContours(
  source: CachedGlyph,
): Array<{ counterId: number; outerId: number }> {
  const shapes = source.contours.map((contour) => {
    const points = outlinePoints(contour)
    return { id: contour.id, points, area: signedArea(points) }
  })
  return shapes.flatMap((counter) => {
    if (!counter.area || !counter.points.length) return []
    const enclosing = shapes
      .filter(
        (outer) =>
          outer.id !== counter.id &&
          Math.sign(outer.area) === -Math.sign(counter.area) &&
          Math.abs(outer.area) > Math.abs(counter.area) &&
          counter.points.every((point) => containsPoint(outer.points, point)),
      )
      .sort((a, b) => Math.abs(a.area) - Math.abs(b.area))[0]
    return enclosing ? [{ counterId: counter.id, outerId: enclosing.id }] : []
  })
}

export function validateReview(
  source: CachedGlyph,
  review: GlyphReview,
): { blockers: ReviewBlocker[] } {
  const blockers = new Set<ReviewBlocker>()
  if (review.blockers.includes('needs-split')) blockers.add('needs-split')
  if (
    review.reviewSchemaVersion !== REVIEW_SCHEMA_VERSION ||
    review.syllable !== source.syllable ||
    review.source.sourceGlyphHash !== source.sourceGlyphHash ||
    JSON.stringify(review.source.extraction) !==
      JSON.stringify(source.extraction)
  )
    blockers.add('fingerprint-mismatch')
  if (
    review.steps.length !== source.physicalSteps.length ||
    review.steps.some(
      (step, index) =>
        step.order !== source.physicalSteps[index]?.order ||
        step.jamo !== source.physicalSteps[index]?.jamo,
    )
  )
    blockers.add('ambiguous-ownership')
  const usedContours = new Map<number, number>()
  const usedPieces = new Map<string, number>()
  for (const step of review.steps) {
    if (step.geometry.length === 0) blockers.add('empty-physical-step')
    for (const ref of step.geometry) {
      if (ref.kind === 'contour')
        usedContours.set(
          ref.contourId,
          (usedContours.get(ref.contourId) ?? 0) + 1,
        )
      else {
        const key = `${ref.recipeId}/${ref.pieceId}`
        usedPieces.set(key, (usedPieces.get(key) ?? 0) + 1)
      }
    }
  }
  const consumed = review.splitRecipes.flatMap(
    ({ sourceContourId, counterContours = [] }) => [
      sourceContourId,
      ...counterContours.map(({ contourId }) => contourId),
    ],
  )
  const replaced = new Set(consumed)
  // A contour may be consumed by at most one recipe, as its source or a counter.
  if (replaced.size !== consumed.length) blockers.add('duplicate-ownership')
  if (review.splitRecipes.some((recipe) => !recipeIsValid(source, recipe)))
    blockers.add('invalid-split-recipe')
  for (const recipe of review.splitRecipes) {
    for (const piece of recipe.pieces) {
      const count = usedPieces.get(`${recipe.id}/${piece.id}`) ?? 0
      if (count === 0) blockers.add('unassigned-source-geometry')
      if (count > 1) blockers.add('duplicate-ownership')
    }
  }
  for (const contour of source.contours) {
    const count = usedContours.get(contour.id) ?? 0
    if (replaced.has(contour.id)) {
      if (count) blockers.add('duplicate-ownership')
    } else if (count === 0) blockers.add('unassigned-source-geometry')
    else if (count > 1) blockers.add('duplicate-ownership')
  }
  // A counter is part of the letter whose outline encloses it. Giving it to a
  // different step paints the hole as a solid shape, which coverage checks
  // alone cannot see; the union outline needs a split instead.
  const ownerOf = new Map(
    review.steps.flatMap((step) =>
      step.geometry.flatMap((ref) =>
        ref.kind === 'contour' ? [[ref.contourId, step.order] as const] : [],
      ),
    ),
  )
  if (
    counterContours(source).some(
      ({ counterId, outerId }) =>
        ownerOf.has(counterId) &&
        ownerOf.has(outerId) &&
        ownerOf.get(counterId) !== ownerOf.get(outerId),
    )
  )
    blockers.add('counter-owner-mismatch')
  try {
    if (compileReview(source, review).paths.some(({ d }) => !d.startsWith('M')))
      blockers.add('reconstruction-mismatch')
  } catch {
    blockers.add('invalid-split-recipe')
  }
  return { blockers: [...blockers] }
}
