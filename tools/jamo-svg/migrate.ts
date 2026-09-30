import { COMPOUND_JUNGSEONG_PARTS } from '../../src/domain/korean/hangul'
import type { CachedGlyph, GlyphReview, RecipeToken } from './types'

type V1Piece = { id: string; ownerStep: number; tokens: RecipeToken[] }
type V1Review = Omit<GlyphReview, 'reviewSchemaVersion' | 'splitRecipes'> & {
  reviewSchemaVersion: 1
  splitRecipes: Array<Omit<GlyphReview['splitRecipes'][number], 'splitRecipeSchemaVersion' | 'pieces'> & {
    splitRecipeSchemaVersion: 1
    pieces: V1Piece[]
  }>
}

export function migrateV1Review(input: V1Review): { review: GlyphReview; diagnostics: string[] } {
  const diagnostics: string[] = []
  const review = {
    ...input,
    reviewSchemaVersion: 2 as const,
    splitRecipes: input.splitRecipes.map((recipe) => ({
      ...recipe,
      splitRecipeSchemaVersion: 2 as const,
      pieces: recipe.pieces.map(({ ownerStep, ...piece }) => {
        const owners = input.steps.filter((step) => step.geometry.some((geometry) => geometry.kind === 'split-piece' && geometry.recipeId === recipe.id && geometry.pieceId === piece.id))
        if (owners.length !== 1) diagnostics.push(`${input.syllable}: ${recipe.id}/${piece.id} has ${owners.length} reviewed-step owners.`)
        else if (owners[0].order !== ownerStep) diagnostics.push(`${input.syllable}: ${recipe.id}/${piece.id} V1 ownerStep differs from reviewed-step ownership.`)
        return piece
      }),
    })),
  } satisfies GlyphReview
  return { review, diagnostics }
}

/**
 * Physical-step algorithm v1 expanded compound medials into their typed parts;
 * v2 keeps each compound medial as one visual step. Unchanged step sequences
 * keep their review state. Merged sequences concatenate the parts' geometry in
 * order and lose approval, because the reviewer must confirm the new step.
 */
export function migrateStepAlgorithmReview(
  input: GlyphReview,
  source: CachedGlyph,
): { review: GlyphReview; diagnostics: string[] } {
  const diagnostics: string[] = []
  const unchanged =
    input.steps.length === source.physicalSteps.length &&
    input.steps.every((step, index) => step.jamo === source.physicalSteps[index].jamo)
  const base = { ...input, source: { ...input.source, extraction: source.extraction } }
  if (unchanged) return { review: base, diagnostics }
  let cursor = 0
  const steps = source.physicalSteps.map(({ order, jamo, slot }) => {
    const parts =
      slot === 'jungseong' ? (COMPOUND_JUNGSEONG_PARTS[jamo] ?? [jamo]) : [jamo]
    const previous = input.steps.slice(cursor, cursor + parts.length)
    cursor += parts.length
    if (previous.map((step) => step.jamo).join() !== parts.join())
      diagnostics.push(`${input.syllable}: cannot map v1 steps onto ${jamo}.`)
    return { order, jamo, geometry: previous.flatMap((step) => step.geometry) }
  })
  if (cursor !== input.steps.length)
    diagnostics.push(`${input.syllable}: v1 step count does not match v2 steps.`)
  return {
    review: {
      ...base,
      approved: undefined,
      status: input.status === 'unreviewed' ? 'unreviewed' : 'reviewing',
      steps,
    },
    diagnostics,
  }
}
