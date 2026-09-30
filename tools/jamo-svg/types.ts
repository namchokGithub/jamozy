export const EXTRACTION_SCHEMA_VERSION = 1 as const
export const PATH_NORMALIZATION_VERSION = 1 as const
export const PHYSICAL_STEP_ALGORITHM_VERSION = 2 as const
export const REVIEW_SCHEMA_VERSION = 2 as const
export const SPLIT_RECIPE_SCHEMA_VERSION = 2 as const

export type Bounds = { x1: number; y1: number; x2: number; y2: number }
export type OutlineCommand = {
  type: 'M' | 'L' | 'C' | 'Q' | 'Z'
  x?: number
  y?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
}
export type JamoSlot = 'choseong' | 'jungseong' | 'jongseong'
export type MedialLayoutClass =
  | 'vertical'
  | 'horizontal'
  | 'compound-horizontal-leading'
  | 'compound-vertical-leading'
  | 'mixed-eui'

export type ExtractionFingerprint = {
  fontSha256: string
  extractionSchema: typeof EXTRACTION_SCHEMA_VERSION
  pathNormalization: typeof PATH_NORMALIZATION_VERSION
  physicalStepAlgorithm: typeof PHYSICAL_STEP_ALGORITHM_VERSION
}
export type CachedContour = {
  id: number
  d: string
  commands: OutlineCommand[]
  commandHash: string
  bounds: Bounds
  commandTypes: string
}
export type GlyphFamilyKey = {
  queueKey: {
    medialLayout: MedialLayoutClass
    hasFinal: boolean
    compoundMedial: string | null
    compoundFinal: string | null
    physicalStepCount: number
    contourRelation: 'deficit' | 'aligned' | 'surplus'
  }
  semanticKey: {
    choseong: string
    jungseong: string
    jongseong: string
    medialLayout: MedialLayoutClass
  }
}
export type CachedGlyph = {
  syllable: string
  codePoint?: `U+${string}`
  extraction: ExtractionFingerprint
  sourceGlyphHash: string
  physicalSteps: Array<{ order: number; jamo: string; slot: JamoSlot }>
  hangul: {
    choseong: string
    jungseong: string
    jongseong: string
    medialLayout: MedialLayoutClass
    compoundMedial: string | null
    compoundFinal: string | null
  }
  advanceWidth: number
  bounds: Bounds
  sourcePath: string
  contours: CachedContour[]
  signals: { contourRelation: 'deficit' | 'aligned' | 'surplus'; commandCount: number; oneContourMultiStep: boolean }
  family: GlyphFamilyKey
}

export type WholeContourRef = { kind: 'contour'; contourId: number }
export type SplitPieceRef = { kind: 'split-piece'; recipeId: string; pieceId: string }
export type GeometryRef = WholeContourRef | SplitPieceRef
export type ReviewedStep = { order: number; jamo: string; geometry: GeometryRef[] }
export type ReviewStatus = 'unreviewed' | 'proposed' | 'reviewing' | 'approved' | 'stale'
export type ReviewBlocker =
  | 'unassigned-source-geometry'
  | 'duplicate-ownership'
  | 'empty-physical-step'
  | 'ambiguous-ownership'
  | 'needs-split'
  | 'invalid-split-recipe'
  | 'reconstruction-mismatch'
  | 'fingerprint-mismatch'
export type SourceAnchor = { contourId: number; commandIndex: number; point: 'start' | 'end' | 'control1' | 'control2' }
export type RecipeToken =
  | { kind: 'source-range'; fromCommand: number; toCommand: number }
  | { kind: 'move-to-anchor'; anchor: SourceAnchor }
  | { kind: 'line-to-anchor'; anchor: SourceAnchor; reason: 'interior-closure-seam' }
  | { kind: 'close-to-start'; reason: 'interior-closure-seam' }
export type SplitPiece = { id: string; tokens: RecipeToken[] }
export type SplitRecipe = {
  splitRecipeSchemaVersion: typeof SPLIT_RECIPE_SCHEMA_VERSION
  id: string
  sourceContourId: number
  sourceContourHash: string
  method: 'source-command-partition'
  pieces: SplitPiece[]
  rationale: string
  visualValidation: { sourceContourHash: string; reconstructionHash?: string }
}
export type GlyphReview = {
  reviewSchemaVersion: typeof REVIEW_SCHEMA_VERSION
  syllable: string
  source: Pick<CachedGlyph, 'extraction' | 'sourceGlyphHash'>
  status: ReviewStatus
  blockers: ReviewBlocker[]
  steps: ReviewedStep[]
  splitRecipes: SplitRecipe[]
  notes?: string
  approved?: { at: string; reviewer: string; validatorVersion: 1; validationHash: string }
}
export type CompiledGlyph = { width: number; paths: Array<{ jamo: string; d: string }> }
