import {
  REVIEW_SCHEMA_VERSION,
  SPLIT_RECIPE_SCHEMA_VERSION,
  type CachedGlyph,
  type CompiledGlyph,
  type GlyphReview,
  type ReviewBlocker,
  type SplitRecipe,
} from './types'
import { compileSplitPiecePreview } from './split-workbench'

export * from './types'

export function compileRecipePiece(source: CachedGlyph, recipe: SplitRecipe, pieceId: string): string {
  const contour = source.contours.find(({ id }) => id === recipe.sourceContourId)
  const piece = recipe.pieces.find(({ id }) => id === pieceId)
  if (!contour || !piece) throw new Error('Unknown split recipe piece.')
  return compileSplitPiecePreview(contour, piece)
}

export function compileReview(source: CachedGlyph, review: GlyphReview): CompiledGlyph {
  const recipeById = new Map(review.splitRecipes.map((recipe) => [recipe.id, recipe]))
  return {
    width: source.advanceWidth,
    paths: review.steps.map((step) => ({
      jamo: step.jamo,
      d: step.geometry.map((ref) => {
        if (ref.kind === 'contour') {
          const contour = source.contours.find(({ id }) => id === ref.contourId)
          if (!contour) throw new Error(`Unknown contour ${ref.contourId}.`)
          return contour.d
        }
        const recipe = recipeById.get(ref.recipeId)
        if (!recipe) throw new Error(`Unknown split recipe ${ref.recipeId}.`)
        return compileRecipePiece(source, recipe, ref.pieceId)
      }).join(' '),
    })),
  }
}

function recipeIsValid(source: CachedGlyph, recipe: SplitRecipe): boolean {
  const contour = source.contours.find(({ id }) => id === recipe.sourceContourId)
  if (!contour || recipe.splitRecipeSchemaVersion !== SPLIT_RECIPE_SCHEMA_VERSION || contour.commandHash !== recipe.sourceContourHash) return false
  const ids = new Set<string>()
  // A source range or an explicit move anchor consumes source geometry. A
  // line-to anchor is only a declared synthetic closure seam, so it must not
  // make a command look owned by a piece.
  const coverage = new Map<number, number>()
  const consume = (index: number) => coverage.set(index, (coverage.get(index) ?? 0) + 1)
  const anchorIsUsable = (index: number, point: 'start' | 'end' | 'control1' | 'control2') => {
    const command = contour.commands[index]
    if (!command) return false
    if (point === 'control1') return command.x1 !== undefined && command.y1 !== undefined
    if (point === 'control2') return command.x2 !== undefined && command.y2 !== undefined
    return command.x !== undefined && command.y !== undefined
  }
  const valid = recipe.pieces.every((piece) => {
    if (ids.has(piece.id)) return false
    ids.add(piece.id)
    return piece.tokens.every((token) => {
      if (token.kind === 'source-range') {
        if (token.fromCommand < 0 || token.toCommand < token.fromCommand || token.toCommand >= contour.commands.length) return false
        for (let index = token.fromCommand; index <= token.toCommand; index += 1) consume(index)
      }
      if (token.kind === 'move-to-anchor') {
        if (token.anchor.contourId !== contour.id || !anchorIsUsable(token.anchor.commandIndex, token.anchor.point)) return false
        consume(token.anchor.commandIndex)
      }
      if (token.kind === 'line-to-anchor' && (token.anchor.contourId !== contour.id || !anchorIsUsable(token.anchor.commandIndex, token.anchor.point))) return false
      return true
    })
  })
  return valid && contour.commands.every((_, index) => coverage.get(index) === 1)
}

export function validateReview(source: CachedGlyph, review: GlyphReview): { blockers: ReviewBlocker[] } {
  const blockers = new Set<ReviewBlocker>()
  if (review.blockers.includes('needs-split')) blockers.add('needs-split')
  if (review.reviewSchemaVersion !== REVIEW_SCHEMA_VERSION || review.syllable !== source.syllable || review.source.sourceGlyphHash !== source.sourceGlyphHash || JSON.stringify(review.source.extraction) !== JSON.stringify(source.extraction)) blockers.add('fingerprint-mismatch')
  if (review.steps.length !== source.physicalSteps.length || review.steps.some((step, index) => step.order !== source.physicalSteps[index]?.order || step.jamo !== source.physicalSteps[index]?.jamo)) blockers.add('ambiguous-ownership')
  const usedContours = new Map<number, number>()
  const usedPieces = new Map<string, number>()
  for (const step of review.steps) {
    if (step.geometry.length === 0) blockers.add('empty-physical-step')
    for (const ref of step.geometry) {
      if (ref.kind === 'contour') usedContours.set(ref.contourId, (usedContours.get(ref.contourId) ?? 0) + 1)
      else {
        const key = `${ref.recipeId}/${ref.pieceId}`
        usedPieces.set(key, (usedPieces.get(key) ?? 0) + 1)
      }
    }
  }
  const replaced = new Set(review.splitRecipes.map(({ sourceContourId }) => sourceContourId))
  if (review.splitRecipes.some((recipe) => !recipeIsValid(source, recipe))) blockers.add('invalid-split-recipe')
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
  try {
    if (compileReview(source, review).paths.some(({ d }) => !d.startsWith('M'))) blockers.add('reconstruction-mismatch')
  } catch {
    blockers.add('invalid-split-recipe')
  }
  return { blockers: [...blockers] }
}
