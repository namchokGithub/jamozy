import {
  REVIEW_SCHEMA_VERSION,
  SPLIT_RECIPE_SCHEMA_VERSION,
  type CachedGlyph,
  type CompiledGlyph,
  type GlyphReview,
  type OutlineCommand,
  type ReviewBlocker,
  type SplitRecipe,
} from './types'

export * from './types'

function commandToSvg(command: OutlineCommand): string {
  if (command.type === 'Z') return 'Z'
  if (command.type === 'M' || command.type === 'L') return `${command.type}${command.x} ${command.y}`
  if (command.type === 'Q') return `Q${command.x1} ${command.y1} ${command.x} ${command.y}`
  return `C${command.x1} ${command.y1} ${command.x2} ${command.y2} ${command.x} ${command.y}`
}

function compileRecipePiece(source: CachedGlyph, recipe: SplitRecipe, pieceId: string): string {
  const contour = source.contours.find(({ id }) => id === recipe.sourceContourId)
  const piece = recipe.pieces.find(({ id }) => id === pieceId)
  if (!contour || !piece) throw new Error('Unknown split recipe piece.')
  const result: OutlineCommand[] = []
  let start: { x: number; y: number } | undefined
  for (const token of piece.tokens) {
    if (token.kind === 'source-range') {
      result.push(...contour.commands.slice(token.fromCommand, token.toCommand + 1))
      if (!start) {
        const move = result.find(({ type }) => type === 'M')
        if (move?.x !== undefined && move.y !== undefined) start = { x: move.x, y: move.y }
      }
      continue
    }
    if (token.kind === 'close-to-start') { result.push({ type: 'Z' }); continue }
    const command = contour.commands[token.anchor.commandIndex]
    const x = token.anchor.point === 'control1' ? command?.x1 : token.anchor.point === 'control2' ? command?.x2 : command?.x
    const y = token.anchor.point === 'control1' ? command?.y1 : token.anchor.point === 'control2' ? command?.y2 : command?.y
    if (x === undefined || y === undefined) throw new Error('Invalid recipe anchor.')
    result.push({ type: token.kind === 'move-to-anchor' ? 'M' : 'L', x, y })
    if (!start && token.kind === 'move-to-anchor') start = { x, y }
  }
  if (!start) throw new Error('Split piece has no source geometry.')
  return result.map(commandToSvg).join(' ')
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
  const covered = new Set<number>()
  const valid = recipe.pieces.every((piece) => {
    if (ids.has(piece.id) || piece.ownerStep < 0 || piece.ownerStep >= source.physicalSteps.length) return false
    ids.add(piece.id)
    return piece.tokens.every((token) => {
      if (token.kind === 'source-range') {
        if (token.fromCommand < 0 || token.toCommand < token.fromCommand || token.toCommand >= contour.commands.length) return false
        for (let index = token.fromCommand; index <= token.toCommand; index += 1) covered.add(index)
      }
      if (token.kind === 'move-to-anchor') covered.add(token.anchor.commandIndex)
      return true
    })
  })
  return valid && contour.commands.every((_, index) => covered.has(index))
}

export function validateReview(source: CachedGlyph, review: GlyphReview): { blockers: ReviewBlocker[] } {
  const blockers = new Set<ReviewBlocker>()
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
