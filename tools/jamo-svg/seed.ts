import { compileReview, validateReview } from './compile'
import { extractGlyph } from './extract'
import type { GeometryRef, GlyphReview, SplitRecipe } from './types'

const assignments: Record<string, number[]> = {
  가: [1, 0], 하: [1, 0, 0, 0], 녕: [0, 1, 2, 2], 죄: [0, 1, 2], 화: [2, 0, 1, 0], 값: [1, 0, 2, 2],
}
export const REFERENCE_SYLLABLES = ['가', '하', '녕', '죄', '화', '값'] as const
export async function seedReview(syllable: string): Promise<GlyphReview> {
  const source = await extractGlyph(syllable); const pieces = assignments[syllable]
  if (!pieces) throw new Error(`No verified seed for ${syllable}.`)
  let splitRecipes: SplitRecipe[] = []; const sourceAssignments = pieces
  if (syllable === '값') {
    const contour = source.contours[2]; const commands = contour.commands
    const top = commands[4]; const start = commands[5]; const returnIndex = commands.findIndex((command, index) => index > 5 && command.type === 'L' && command.x === top.x && command.y !== undefined && start.y !== undefined && command.y > start.y)
    if (!top || !start || returnIndex < 0) throw new Error('Unexpected Pretendard 600 값 contour recipe source.')
    splitRecipes = [{ splitRecipeSchemaVersion: 2, id: 'values-bieup-siot-v1', sourceContourId: 2, sourceContourHash: contour.commandHash, method: 'source-command-partition', rationale: 'Verified Pretendard 600 final ㅂ/ㅅ union contour.', visualValidation: { sourceContourHash: contour.commandHash }, pieces: [
      { id: 'bieup', tokens: [{ kind: 'source-range', fromCommand: 0, toCommand: 4 }, { kind: 'line-to-anchor', anchor: { contourId: 2, commandIndex: returnIndex, point: 'end' }, reason: 'interior-closure-seam' }, { kind: 'source-range', fromCommand: returnIndex + 1, toCommand: commands.length - 1 }] },
      { id: 'siot', tokens: [{ kind: 'move-to-anchor', anchor: { contourId: 2, commandIndex: 5, point: 'end' }, }, { kind: 'source-range', fromCommand: 6, toCommand: returnIndex }, { kind: 'close-to-start', reason: 'interior-closure-seam' }] },
    ] }]
  }
  const steps = source.physicalSteps.map((physical, order) => ({ order, jamo: physical.jamo, geometry: source.contours.flatMap<GeometryRef>((contour) => {
    if (syllable === '값' && contour.id === 2) return order === 2 ? [{ kind: 'split-piece' as const, recipeId: 'values-bieup-siot-v1', pieceId: 'bieup' }] : order === 3 ? [{ kind: 'split-piece' as const, recipeId: 'values-bieup-siot-v1', pieceId: 'siot' }] : []
    return sourceAssignments[contour.id] === order ? [{ kind: 'contour' as const, contourId: contour.id }] : []
  }) }))
  const review: GlyphReview = { reviewSchemaVersion: 2, syllable, source: { extraction: source.extraction, sourceGlyphHash: source.sourceGlyphHash }, status: 'reviewing', blockers: [], steps, splitRecipes }
  review.blockers = validateReview(source, review).blockers
  if (review.blockers.length) throw new Error(`Invalid seed ${syllable}: ${review.blockers.join(', ')}`)
  compileReview(source, review); return review
}
