import type { GlyphReview, RecipeToken } from './types'

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
