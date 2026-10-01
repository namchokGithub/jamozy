import { COMPOUND_JUNGSEONG_PARTS } from '../../src/domain/korean/hangul'
import type {
  Bounds,
  CachedGlyph,
  GeometryRef,
  GlyphReview,
  RecipeToken,
} from './types'

type V1Piece = { id: string; ownerStep: number; tokens: RecipeToken[] }
type V1Review = Omit<GlyphReview, 'reviewSchemaVersion' | 'splitRecipes'> & {
  reviewSchemaVersion: 1
  splitRecipes: Array<
    Omit<
      GlyphReview['splitRecipes'][number],
      'splitRecipeSchemaVersion' | 'pieces'
    > & {
      splitRecipeSchemaVersion: 1
      pieces: V1Piece[]
    }
  >
}

export function migrateV1Review(input: V1Review): {
  review: GlyphReview
  diagnostics: string[]
} {
  const diagnostics: string[] = []
  const review = {
    ...input,
    reviewSchemaVersion: 2 as const,
    splitRecipes: input.splitRecipes.map((recipe) => ({
      ...recipe,
      splitRecipeSchemaVersion: 2 as const,
      pieces: recipe.pieces.map(({ ownerStep, ...piece }) => {
        const owners = input.steps.filter((step) =>
          step.geometry.some(
            (geometry) =>
              geometry.kind === 'split-piece' &&
              geometry.recipeId === recipe.id &&
              geometry.pieceId === piece.id,
          ),
        )
        if (owners.length !== 1)
          diagnostics.push(
            `${input.syllable}: ${recipe.id}/${piece.id} has ${owners.length} reviewed-step owners.`,
          )
        else if (owners[0].order !== ownerStep)
          diagnostics.push(
            `${input.syllable}: ${recipe.id}/${piece.id} V1 ownerStep differs from reviewed-step ownership.`,
          )
        return piece
      }),
    })),
  } satisfies GlyphReview
  return { review, diagnostics }
}

export type GeometryBounds = (ref: GeometryRef) => Bounds | undefined

/**
 * Physical-step algorithm v2 kept each compound medial as one visual step; v3
 * gives each typed key its own step (DEC-037). Unchanged step sequences keep
 * their review state. A compound medial's geometry is divided by shape: the
 * widest piece (relative to its height) is the horizontal first key (ㅗ ㅜ ㅡ),
 * and every other piece belongs to the second key. Changed reviews lose
 * approval, because the reviewer must confirm the new steps.
 */
export function migrateStepAlgorithmReview(
  input: GlyphReview,
  source: CachedGlyph,
  boundsOf: GeometryBounds,
): { review: GlyphReview; diagnostics: string[] } {
  const diagnostics: string[] = []
  const unchanged =
    input.steps.length === source.physicalSteps.length &&
    input.steps.every(
      (step, index) => step.jamo === source.physicalSteps[index].jamo,
    )
  const base = {
    ...input,
    source: { ...input.source, extraction: source.extraction },
  }
  if (unchanged) return { review: base, diagnostics }
  let needsSplit = false
  const geometry: GeometryRef[][] = []
  for (const step of input.steps) {
    const parts = COMPOUND_JUNGSEONG_PARTS[step.jamo]
    if (!parts) {
      geometry.push(step.geometry)
      continue
    }
    const shapes = step.geometry.map((ref) => ({ ref, bounds: boundsOf(ref) }))
    const aspect = ({ bounds }: { bounds?: Bounds }) =>
      bounds ? (bounds.x2 - bounds.x1) / Math.max(1, bounds.y2 - bounds.y1) : 0
    const first = [...shapes].sort((a, b) => aspect(b) - aspect(a))[0]
    const rest = shapes.filter((shape) => shape !== first)
    if (
      !first ||
      !rest.length ||
      aspect(first) <= 1 ||
      rest.some((shape) => aspect(shape) >= aspect(first))
    ) {
      diagnostics.push(
        `${input.syllable}: cannot divide ${step.jamo} into ${parts.join(' + ')} by shape.`,
      )
      needsSplit = true
      geometry.push(step.geometry, [])
      continue
    }
    geometry.push(
      [first.ref],
      rest.map(({ ref }) => ref),
    )
  }
  const steps = source.physicalSteps.map(({ order, jamo }) => ({
    order,
    jamo,
    geometry: geometry[order] ?? [],
  }))
  if (geometry.length !== source.physicalSteps.length)
    diagnostics.push(`${input.syllable}: v2 steps do not map onto v3 steps.`)
  return {
    review: {
      ...base,
      approved: undefined,
      status: input.status === 'unreviewed' ? 'unreviewed' : 'reviewing',
      blockers: needsSplit
        ? [...new Set([...input.blockers, 'needs-split' as const])]
        : input.blockers,
      steps,
    },
    diagnostics,
  }
}
