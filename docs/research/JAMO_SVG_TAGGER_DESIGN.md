# Jamo SVG Tagger v1 design

Status: approved development-only Tagger v1 design, with a proposed Split
Workbench v2 design, 2026-09-30. It specifies the review tool and its
implementation boundary; it does not authorize production SVG generation or
any change to the existing Canvas renderer.

Read [the structural analysis](HANGUL_SVG_ANALYSIS.md) first. It is the source
of truth for font choice, physical-jamo rules, measured full-block results,
PoC findings, and project constraints. This document designs the next tool
needed to act on those findings.

### Implementation note

The development implementation uses `pnpm jamo-svg:seed` to generate the
ignored cache and create/update the bounded committed review and queue seeds.
Vite serves the development-only Tagger API under `/__jamo-svg`; it is enabled
only for `serve`, while `/dev/jamo-svg-tagger` remains a development route.

## Goal and non-goals

The Tagger must let a reviewer turn Pretendard 600 source outlines into
reviewed, ordered physical-jamo ownership data, while preserving the original
visible glyph geometry.

```text
local Pretendard 600 TTF → generated extraction cache
  → reviewed ownership / explicit split recipe
  → validation → approved review record
  → (later, separate compiler) minimal runtime SVG data
```

V1 is not an all-Hangul automatic splitter, a production renderer, or a
dataset-generation job. It is a durable review workflow for a small,
representative queue.

## Architecture and seams

The Tagger consists of five deep modules with narrow interfaces:

| Module | Interface responsibility | Implementation responsibility |
| --- | --- | --- |
| Extraction cache | Load a source glyph by syllable and report its exact source identity | Parse the font, derive steps/signals, serialize paths/commands, invalidate stale output |
| Review store | Read/write reviewed glyph records and expose their compatibility state | Layout-agnostic API; choseong-sharded, versioned review files; manifest validation; dev-only local writes |
| Queue store | Read/write review workflow entries and priorities | Separate, versioned queue document; it references reviews but never owns geometry or recipes |
| Recipe compiler | Compile a review record plus source glyph into ordered per-step paths | Resolve contour refs, replay split tokens, preserve command references |
| Validator | Return machine-readable errors/warnings and a reconstruction result | Structural checks, fingerprint checks, geometric comparison, approval eligibility |

The UI calls these modules; it does not reconstruct paths or infer ownership
itself. This gives the Tagger a stable seam: future persistence or extraction
changes stay behind these interfaces.

In particular, UI and domain-facing code use an opaque persistence contract:

```ts
type ReviewStore = {
  get(syllable: string): Promise<GlyphReview | undefined>
  list(filter?: ReviewFilter): Promise<GlyphReviewSummary[]>
  getManifest(): Promise<ReviewManifest>
  save(review: GlyphReview, expectedRevision?: string): Promise<SaveReviewResult>
}

type QueueStore = {
  list(filter?: QueueFilter): Promise<QueueEntry[]>
  save(entry: QueueEntry): Promise<void>
}
```

It never receives a filename, shard key, JSON document, or filesystem path.
The development-only Node adapter derives a choseong shard from the extracted
glyph and owns all physical-layout decisions. `QueueStore` is likewise
separate: it offers queue entries, not review-record internals.

## 1. Extraction cache

### Location and lifecycle

Generate, but do not commit, cache files under:

```text
tools/jamo-svg/cache/<font-fingerprint>/manifest.json
tools/jamo-svg/cache/<font-fingerprint>/choseong-<jamo>.json
```

The 19 choseong shards avoid both 11,172 individual files and one large
browser payload. The cache is reproducible from the bundled TTF and should be
listed in `.gitignore`. It is a convenience for local Tagger work, never the
authoritative reviewed record.

`manifest.json` includes a SHA-256 font fingerprint, extraction-schema
version, path-normalization version, physical-step algorithm version, metrics,
creation time, and shard checksums. A cache is invalid if any of those inputs
change. The Tagger must refuse to load a mismatched cache rather than silently
showing stale geometry.

### Per-glyph cache record

```ts
type ExtractionFingerprint = {
  fontSha256: string
  extractionSchema: 1
  pathNormalization: 1
  physicalStepAlgorithm: 2 // v2: compound medials are one step (DEC-036)
}

type SourceAnchor = {
  contourId: number
  commandIndex: number
  point: 'start' | 'end' | 'control1' | 'control2'
}

type CachedContour = {
  id: number
  d: string
  commands: OpenTypePathCommand[] // exact normalized source commands
  commandHash: string
  bounds: Bounds
  commandTypes: string
}

type CachedGlyph = {
  syllable: string
  codePoint: `U+${string}`
  extraction: ExtractionFingerprint
  sourceGlyphHash: string // hash of normalized whole source outline
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
  signals: StructuralSignals
  family: GlyphFamilyKey
}
```

`StructuralSignals` records measured facts and review priorities such as
contour/step relation, one-contour multi-step status, command count, contour
bounds, and compound-jamo flags. It must not claim jamo ownership or a required
split.

## 2. Review-state model

Use one lifecycle field and a separate set of blockers. A state such as
`needs-split` is not a lifecycle stage: a reviewer can be actively reviewing a
glyph and have both split and ownership blockers. This avoids state explosion.

```ts
type ReviewStatus =
  | 'unreviewed' // no saved proposal
  | 'proposed' // machine or copied template proposal, not accepted
  | 'reviewing' // human edits in progress
  | 'approved' // automatic checks pass and human approved visual review
  | 'stale' // saved source identity no longer matches extraction

type ReviewBlocker =
  | 'unassigned-source-geometry'
  | 'duplicate-ownership'
  | 'empty-physical-step'
  | 'ambiguous-ownership'
  | 'needs-split'
  | 'invalid-split-recipe'
  | 'reconstruction-mismatch'
  | 'fingerprint-mismatch'
  | 'counter-owner-mismatch'
```

`counter-owner-mismatch` fires when a counter (hole) contour and the outline
enclosing it belong to different physical steps. That assignment passes
coverage checks but paints the hole as a solid shape; it means the enclosing
outline is a union of two jamo and needs a split.

Allowed transitions:

```text
unreviewed → proposed | reviewing
proposed   → reviewing | unreviewed
reviewing  → proposed | approved
approved   → reviewing | stale
stale      → unreviewed | proposed | reviewing
```

`approved` requires zero blocking validation errors and an explicit human
approval action. Any source fingerprint/hash mismatch automatically changes an
approved record to `stale`; it cannot be exported. Editing an approved record
returns it to `reviewing` and clears its approval metadata.

## 3. Ownership schema

The following is the implemented V1 shape. For all future Split Workbench
work, the V2 ownership shape in [Split Workbench v2](#12-split-workbench-v2-design)
supersedes it; V1 repeats piece ownership in two places and must not be
extended.

The review record owns no source geometry itself. It references immutable
cache contours and, where needed, recipe-generated pieces. A source contour is
either assigned as a whole to exactly one step, or replaced by one split recipe
whose pieces are assigned to steps.

```ts
type WholeContourRef = { kind: 'contour'; contourId: number }
type SplitPieceRef = { kind: 'split-piece'; recipeId: string; pieceId: string }
type GeometryRef = WholeContourRef | SplitPieceRef

type ReviewedStep = {
  order: number // must equal the CachedGlyph physical step order
  jamo: string // must equal the CachedGlyph physical step jamo
  geometry: GeometryRef[] // preserves desired combination order
}

type GlyphReview = {
  reviewSchemaVersion: 1
  syllable: string
  source: Pick<CachedGlyph, 'extraction' | 'sourceGlyphHash'>
  status: ReviewStatus
  blockers: ReviewBlocker[]
  steps: ReviewedStep[]
  splitRecipes: SplitRecipe[]
  notes?: string
  proposedFrom?: ProposalProvenance
  approved?: {
    at: string
    reviewer: string
    validatorVersion: 1
    validationHash: string
  }
}
```

This supports the proven cases without special cases in the schema:

| Syllable | Ownership representation |
| --- | --- |
| `가` | two whole contour refs, one per step |
| `하` | `ㅏ` references Contour 1; `ㅎ` references Contours 2–4 in one step, including the counter contour |
| `값` | `ㄱ`, `ㅏ`, and the final `ㅂ` counter use whole contours; the mixed source contour is replaced by two recipe pieces owned by `ㅂ` and `ㅅ` |

No step is inferred from contour order. The `steps` array is ordered from the
cache's Jamozy physical typing sequence, so a compiled output always uses
typing order rather than source-path order.

## 4. Auditable split recipes

This V1 recipe shape is retained here for migration context. The V2 recipe
shape in [Split Workbench v2](#12-split-workbench-v2-design) removes its
duplicate `ownerStep` field while retaining every source-command token.

A recipe is a constrained compiler input, not an arbitrary replacement SVG
path. It can replay exact source command ranges, start a new subpath at a
source anchor, and add only an explicitly recorded straight closure seam
between source anchors.

```ts
type RecipeToken =
  | { kind: 'source-range'; fromCommand: number; toCommand: number }
  | { kind: 'move-to-anchor'; anchor: SourceAnchor }
  | {
      kind: 'line-to-anchor'
      anchor: SourceAnchor
      reason: 'interior-closure-seam'
    }
  | { kind: 'close-to-start'; reason: 'interior-closure-seam' }

type SplitPiece = {
  id: string
  ownerStep: number
  tokens: RecipeToken[]
}

type SplitRecipe = {
  splitRecipeSchemaVersion: 1
  id: string
  sourceContourId: number
  sourceContourHash: string
  method: 'source-command-partition'
  pieces: SplitPiece[]
  rationale: string
  visualValidation: { sourceContourHash: string; reconstructionHash?: string }
}
```

The compiler rejects token ranges outside the referenced source contour and
rejects arbitrary coordinates. `move-to-anchor` and seam endpoints must point
to source-command vertices. A line or close token is therefore visible in the
recipe and auditable as an internal seam; it cannot disguise a hand-redrawn
glyph. The `값` recipe is the reference implementation shape: a unioned final
contour is partitioned into final `ㅂ` and `ㅅ` pieces with a closure seam that
does not alter the visible union.

Recipe validation checks source-contour hash equality, unique piece IDs,
valid owner steps, valid token ranges/anchors, and one-color reconstruction.

## 5. Family keys and grouping

Raw OpenType command signatures do not form useful global families (10,236
signatures across 11,172 glyphs). V1 therefore records two different keys:

```ts
type GlyphFamilyKey = {
  // Used for navigation and candidate comparison; not safe for auto-apply.
  queueKey: {
    medialLayout: MedialLayoutClass
    hasFinal: boolean
    compoundMedial: string | null
    compoundFinal: string | null
    physicalStepCount: number
    contourRelation: 'deficit' | 'aligned' | 'surplus'
  }
  // Used only to find close reviewed examples. Exact jamo identities remain
  // visible because their geometry can differ despite similar layouts.
  semanticKey: {
    choseong: string
    jungseong: string
    jongseong: string
    medialLayout: MedialLayoutClass
  }
}
```

`MedialLayoutClass` should begin with a small explicit classifier based on the
current jamo lists: vertical, horizontal, compound-horizontal-leading,
compound-vertical-leading, and `ㅢ`-mixed. The classifier is a grouping aid,
not geometry truth.

Use `queueKey` for buckets and queue filters. Use `semanticKey`, contour count,
per-contour bounds, and source-image comparison to suggest nearby reviewed
examples. Compound identity, contour deficit, one-contour multi-step status,
and command count are prioritization signals; they must never automatically
apply ownership or declare a split.

## 6. Review queue

V1 operates on a bounded queue, not all 11,172 syllables. The initial queue
contains pinned references plus three deliberately different review slices:

1. **References:** `가`, `하`, `값`, plus the existing inspected `녕`, `죄`,
   and `화`.
2. **`ㅄ` compound-final slice:** a small stratified sample across initial
   shape and medial layout, with `값` pinned. This is the known union family;
   do not assume all 399 members need the same split.
3. **One-contour multi-step slice:** examples from the measured 47, including
   `굵`, `굸`, `귟`, and at least one five-step example such as `귌`.
4. **Contour-surplus slice:** a small family with verified counter ownership,
   beginning with `하` and related `ㅎ` layouts, to exercise combining several
   contours into one step.

Each row stores a priority, reason(s), queue key, and links to nearest approved
examples. Review status is read from `ReviewStore`; if a queue snapshot is
retained for display it is advisory only. Queue entries never copy ownership,
split recipes, source hashes, or approval data. Priority order: stale first;
then unresolved split blockers; then one-contour multi-step; compound finals;
high contour surplus/complexity; then normal proposals. Queue signals overlap
and are not summed as a difficulty score.

## 7. Development-only Tagger workflow

```text
select queue item
  → load immutable source glyph + prior review
  → inspect source contours and suggested ownership
  → accept/edit whole-contour ownership
  → create a constrained split recipe only when required
  → inspect colored result and source/reconstruction overlay
  → run automatic validation
  → visually approve → save versioned review record → next queue item
```

Practical V1 UI:

- Queue sidebar: progress, status, priority, signal filters, family filters,
  search by syllable/code point, and next/previous keyboard navigation.
- Main canvas: original font glyph, source outline, individual contour/piece
  previews, per-step colors, and one-color reconstruction overlay.
- Ownership editor: select a physical step for each whole contour; show a
  live unassigned/duplicate indicator; permit multiple contour refs per step.
- Split panel: disabled by default; requires selecting one source contour,
  then presents source-command anchors/ranges and explicit closure seams.
- Validation panel: blocking errors separately from warnings; source versus
  reconstruction diff and a required visual-approval checkbox.
- Productivity: `j/k` queue navigation, digit keys for step assignment,
  undo/redo within the current unsaved draft, copy current review JSON, and
  copy compiled runtime-preview JSON.

No browser-local data is authoritative. Browser storage may retain an unsaved
draft for refresh recovery only, labeled as a draft and discarded if its source
fingerprint changes.

## 8. Validation and approval

### Automatic blockers

- Review source font/extraction/source-glyph hashes exactly match the cache.
- Step count, jamo values, and order exactly match the extracted physical
  sequence.
- Every source contour is either assigned once as a whole or replaced by one
  valid split recipe; no whole contour is duplicated across steps.
- Every physical step has at least one compiled geometry reference.
- Every split recipe has valid command ranges and anchors against the exact
  source contour hash.
- Compiled `d` values are valid SVG paths with `evenodd` fill semantics.
- One-color reconstruction passes a deterministic raster comparison at agreed
  resolutions/scales with no unexpected source/reconstruction pixels. Internal
  seams may exist only where a recipe declares them.

### Warnings and human approval

- Geometrically close but not exact raster comparison.
- Compound-final, contour-deficit, one-contour multi-step, or high-complexity
  signals.
- An auto proposal copied from a different semantic key.

Human approval remains required because automatic geometry cannot establish
semantic jamo ownership. The reviewer confirms colored typing-step order,
counter/hole handling, and source-overlay fidelity before `approved` is set.

## 9. Persistence and runtime boundary

### Development/review metadata (authoritative)

Keep compact, human-reviewable review JSON under version control, sharded by
the syllable's extracted choseong from the first saved record:

```text
tools/jamo-svg/reviews/pretendard-600/
  manifest.json
  ㄱ.json
  ㄲ.json
  ㄴ.json
  ...
  ㅎ.json

tools/jamo-svg/queue/pretendard-600/
  queue.json
```

Each populated review shard contains only syllables whose choseong is
its filename and is the sole authoritative home for those glyph reviews:

```ts
type ReviewShard = {
  shardSchemaVersion: 1
  choseong: string
  fontFingerprint: string
  physicalStepAlgorithmVersion: 1
  splitRecipeSchemaVersion: 1
  reviews: Record<string, GlyphReview>
}

type ReviewManifest = {
  manifestSchemaVersion: 1
  reviewRecordSchemaVersion: 1
  splitRecipeSchemaVersion: 1
  activeFontFingerprint: string
  physicalStepAlgorithmVersion: 1
  shards: Array<{
    choseong: string
    file: string
    reviewCount: number
    sha256: string
  }>
}

type QueueEntry = {
  syllable: string
  priority: number
  reasons: string[]
  queueKey: GlyphFamilyKey['queueKey']
  nearestApprovedSyllables: string[]
}

type QueueDocument = {
  queueSchemaVersion: 1
  fontFingerprint: string
  entries: QueueEntry[]
}
```

The manifest is the compatibility gate. The adapter refuses to silently load
or save when its schema versions, active font fingerprint, physical-step
algorithm version, listed shard count, or checksum do not match. A missing
shard is valid only when it is absent from the manifest; an empty choseong
does not require an empty file. `GlyphReview.reviewSchemaVersion` and each
`SplitRecipe.splitRecipeSchemaVersion` make record-level incompatibilities
explicit as well.

The review store is durable across refreshes, dev-server restarts, and future
chat sessions because it lives in the repository. The dev-only Vite/local Node
adapter is the only component that understands this layout; it must be
unavailable in production builds. Browser storage may hold an unsaved draft,
but it is never authoritative or implicitly promoted.

### Safe, small review writes

Saving one glyph loads and validates only its chosen-initial shard, validates
the proposed record against the current extraction cache and manifest, then
rewrites that shard in deterministic syllable order. It does not rewrite the
other 18 review shards. It also updates the small manifest entry for that
shard's count and checksum; the queue changes only when an explicit queue
operation requests it.

The Node adapter writes a same-directory temporary shard, parses and validates
it, then atomically replaces the destination. It applies the same temporary
file → validation → atomic-replace sequence to `manifest.json`. A small
write-intent record records the old and new shard hashes until both replaces
have completed; on startup the adapter either completes the compatible manifest
update or reports a recoverable inconsistency for explicit repair. This avoids
silently treating a partially completed two-file update as valid while keeping
each glyph edit confined to one review shard plus the manifest.

`save` accepts an expected shard revision/checksum. A changed checksum causes a
conflict response rather than a lost update, so parallel reviewers reload and
resolve only the relevant choseong shard. Deterministic record ordering and
checksums make both recovery and diffs inspectable.

### Git and independent review workflow

An ownership edit normally changes `manifest.json` and one choseong shard,
rather than a repository-wide review file. That keeps diffs focused on the
reviewed glyph, reduces merge conflicts between work on different initials,
and lets reviewers or future tooling work independently by choseong family.
The manifest's aggregate metadata may occasionally conflict, but it is small,
mechanically regenerated from committed shards after a merge; review records
remain the human-reviewed source of truth. Queue-only prioritization changes
stay in the separate queue file and do not conflict with ownership or split
reviews.

### Explicit schema migration

Schema changes are never interpreted optimistically. A known migration must be
an explicit development command that declares its input and output manifest,
migrates and validates shards one at a time, updates every affected schema
version and checksum, and leaves the old committed data recoverable through
Git. Unknown review-record, split-recipe, shard, queue, or manifest versions
block loading with a diagnostic. A font fingerprint or physical-step algorithm
mismatch is not a JSON-schema migration: affected reviews are marked stale and
must be revalidated against regenerated source geometry before approval or
export.

The extraction cache remains separately choseong-sharded, generated, and
uncommitted under `tools/jamo-svg/cache/<font-fingerprint>/`. It remains
reproducible convenience data; reviewed shards are the committed authority.

### Future production runtime data (derived, minimal)

Only a later, separate compiler may read approved review records and generate:

```ts
type RuntimeJamoSvgGlyph = {
  width: number
  paths: Array<{ jamo: string; d: string }>
}

type RuntimeJamoSvgDataset = Record<string, RuntimeJamoSvgGlyph>
```

It contains no source commands, contours, cache metadata, review state,
reviewer notes, split rationale, queue information, or validation artifacts.
The runtime renderer remains unchanged until this derived dataset and its
integration are separately designed and approved.

## 10. Durability audit and intentionally deferred decisions

The extraction cache was already structurally durable for full-block work: it
is fingerprint-scoped, choseong-sharded, checksummed, generated, and ignored
by Git. This revision gives the committed review authority the same scalable
partitioning, adds separate queue persistence, and versions every persisted
layer that could otherwise require an ambiguous future migration. No remaining
V1 persistence choice is expected to require a structural migration merely
because review coverage grows from a few examples to all 11,172 syllables.

The following decisions remain intentionally deferred because they need real
review data rather than a larger storage shape:

- Whether family proposals are reliable enough to auto-apply within any
  semantic/geometry cluster. V1 only suggests them for human review.
- The exact deterministic raster-comparison resolutions and tolerances. The
  validator records its version and must invalidate approvals if that semantic
  validation contract changes.
- Reviewer identity/authorship policy. The existing approval label is adequate
  for a development repository; adding identities later does not alter shard
  ownership or geometry schemas.
- Runtime dataset file partitioning and delivery strategy. It stays a separate
  compiler concern because runtime data must remain the minimal derived shape,
  not a copy of review storage.

## 11. Implementation phases (future work)

1. Generate sharded cache and manifest from the fixed font; add stale-cache
   diagnostics.
2. Add committed choseong-sharded review records, manifest, and separate queue
   schema plus dev-only `ReviewStore`/`QueueStore` adapters with safe writes,
   checksum conflict detection, and stale-data diagnostics.
3. Build a read-only queue/source inspector with the six reference records.
4. Add whole-contour ownership editing, validation, draft recovery, and save.
5. Add constrained source-command split recipes and reconstruction validation.
6. Review the bounded queue; only then measure reviewed-family reuse before
   considering broader propagation or a dataset compiler.

## Smallest useful Tagger v1 scope

Implement phases 1–4 plus the minimum constrained split recipe support needed
to express the already verified `값` case. Begin directly with the sharded
manifest-backed persistence described above, even for the six seed records.
Seed only the six PoC references and a small, explicit queue drawn from the
`ㅄ`, one-contour multi-step, and contour-surplus slices. This proves durable
review, multi-contour ownership, counter handling, one-color validation, and
one auditable split before any attempt to scale or generate a production
dataset.

## 12. Split Workbench v2 design

### Purpose and observed input

V2 is a development-only manual workbench for cases that whole-contour
ownership cannot express. It does not infer ownership, choose seams, redraw
paths, run boolean geometry operations, or generate runtime data. A reviewer
uses it to create an auditable split recipe from the authoritative Pretendard
600 cache, then visually verifies the compiled result before clearing the
existing blocker and approving the review.

The first six manually reviewed split candidates define its scope:

| Family | Candidates | Measured/reviewed condition | Intended representation |
| --- | --- | --- | --- |
| Mixed final `ㅂ + ㅅ` | `값`, `낪`, `닶` | An outer contour contains both physical final steps; a separate counter may belong to `ㅂ`. | Replace only the mixed contour with two recipe pieces; keep independently owned counter contours as whole refs. |
| Compact / monolithic | `굵`, `굸`, `귟`, `귌` | One or a very small number of contours carries several physical steps. `귌` has two cached contours despite its current note describing one compact source case. | A reviewer selects the relevant contour(s) and creates as many manually owned recipe pieces as required; unaffected contours remain whole refs. |

`값` remains the verified reference recipe. `낪` and `닶` are not assumed to
share its exact command ranges or seams: they share only a family hypothesis
that must be verified in the workbench. The compact family is intentionally
not reduced to a single template; its piece boundaries are glyph-specific.

### Non-negotiable geometry constraint

Each V2 piece is a source-command partition. It may replay contiguous ranges
of normalized commands from one selected source contour, start a subpath at a
valid source anchor, and add an explicit straight closure seam between valid
source anchors. It may not contain freehand drawing, an arbitrary replacement
`d`, a curve that is not in the source, or output from a generic boolean path
splitter. The recipe must identify every non-source seam so a reviewer can see
why it exists.

This preserves Pretendard geometry: exterior geometry is replayed directly
from the bundled TTF; only declared interior closure seams make an otherwise
open partition independently fillable.

### V2 authoritative schema

`ReviewedStep.geometry` is the sole persisted ownership source of truth for
validation, preview, persistence, and eventual export. A split piece does not
persist an `ownerStep`; its owner is derived by finding the one reviewed step
that references `{ kind: 'split-piece', recipeId, pieceId }`.

```ts
type WholeContourRef = { kind: 'contour'; contourId: number }
type SplitPieceRef = { kind: 'split-piece'; recipeId: string; pieceId: string }
type GeometryRef = WholeContourRef | SplitPieceRef

type ReviewedStepV2 = {
  order: number
  jamo: string
  geometry: GeometryRef[] // ordered source of truth
}

type RecipeTokenV2 =
  | { kind: 'source-range'; fromCommand: number; toCommand: number }
  | { kind: 'move-to-anchor'; anchor: SourceAnchor }
  | { kind: 'line-to-anchor'; anchor: SourceAnchor; reason: 'interior-closure-seam' }
  | { kind: 'close-to-start'; reason: 'interior-closure-seam' }

type SplitPieceV2 = {
  id: string
  tokens: RecipeTokenV2[]
}

type SplitRecipeV2 = {
  splitRecipeSchemaVersion: 2
  id: string
  sourceContourId: number
  sourceContourHash: string
  method: 'source-command-partition'
  pieces: SplitPieceV2[]
  rationale: string
  visualValidation: { sourceContourHash: string; reconstructionHash?: string }
}

type ApprovalRecord = {
  at: string
  reviewer: string
  validatorVersion: number
  validationHash: string
}

type GlyphReviewV2 = {
  reviewSchemaVersion: 2
  syllable: string
  source: Pick<CachedGlyph, 'extraction' | 'sourceGlyphHash'>
  status: ReviewStatus
  blockers: ReviewBlocker[]
  steps: ReviewedStepV2[]
  splitRecipes: SplitRecipeV2[]
  notes?: string
  approved?: ApprovalRecord
}

type ReviewShardV2 = {
  shardSchemaVersion: 2
  choseong: string
  fontFingerprint: string
  physicalStepAlgorithmVersion: 1
  splitRecipeSchemaVersion: 2
  reviews: Record<string, GlyphReviewV2>
}

type ReviewManifestV2 = {
  manifestSchemaVersion: 2
  reviewRecordSchemaVersion: 2
  splitRecipeSchemaVersion: 2
  activeFontFingerprint: string
  physicalStepAlgorithmVersion: 1
  shards: Array<{ choseong: string; file: string; reviewCount: number; sha256: string }>
}
```

The V2 compiler resolves a piece's owner only from `steps`. The UI derives the
selected owner in the same way. A piece referenced zero times is unassigned;
one time is assigned; more than once is duplicate ownership. This removes the
V1 divergence risk between `SplitPiece.ownerStep` and `ReviewedStep.geometry`.

`QueueDocument` remains schema version 1 because it stores workflow priority,
not split geometry. It must not absorb review ownership or recipes.

### V1 to V2 migration

Migration is a deliberate development command, never an implicit load-time
reinterpretation. It processes one choseong shard at a time, validates against
the active extraction cache, writes a temporary V2 shard, validates it again,
atomically replaces the shard, then updates the V2 manifest checksum. Git
retains the V1 revision as recovery history.

For every V1 `SplitPiece`:

1. Read its V1 `ownerStep` only as a migration cross-check.
2. Find the authoritative V1 `SplitPieceRef` in `review.steps`.
3. If exactly one step references it, retain all recipe tokens unchanged,
   remove `ownerStep`, and derive its V2 owner from that step.
4. If the V1 field and step reference disagree, retain the `steps` assignment
   as the documented V1 export source of truth, emit a migration diagnostic,
   and require human review before approval.
5. If a piece is unassigned or duplicated, migrate its tokens but preserve the
   existing validation blocker; it remains reviewing and cannot be approved.

The verified `값` recipe migrates deterministically: its `bieup` and `siot`
piece tokens, source contour hash, rationale, closure seams, and step refs are
copied unchanged; only each redundant `ownerStep` is removed. Its outer
counter remains a whole-contour ref in the `ㅂ` reviewed step. No visible
Pretendard geometry is lost or regenerated.

Unknown V1/V2 record, recipe, shard, or manifest versions are a hard loading
error. A tool must report that migration is required and refuse to save or
approve until the known migration completes. Font/extraction fingerprint or
physical-step-algorithm mismatches are separately stale-source conditions,
not schema migrations.

### Current review-state inconsistency

The reviewed records currently contain two explicit states:

- `굵`, `굸`, `귟`, and `귌` are `reviewing` with the persisted
  `needs-split` blocker.
- `낪` and `닶` have reviewer notes stating that `ㅂ + ㅅ` must split, but
  their persisted blocker arrays are currently empty.

V2 must not parse note prose as geometry or silently mutate either state. When
a saved review has a note but no `needs-split`, the workbench presents a
prominent **review-state consistency warning**: “This note may describe
unresolved split work; confirm its blocker state.” The reviewer explicitly
chooses either **Mark needs split** or **Keep note without a split blocker**.
Both are intentional review actions; neither happens on load or as a side
effect of recipe validation.

`needs-split` remains a review blocker, not a second ownership model and not a
lifecycle status. A structurally valid recipe does **not** remove it. The
reviewer must inspect the final individual physical-step paths, the colored
combined result, the one-color reconstruction, and the source overlay; then
explicitly clear `needs-split` and perform human approval.

### Split Workbench workflow

```text
open a needs-split review
  → resolve any review-state consistency warning explicitly
  → select one source contour to replace
  → inspect its stable command index list and anchors
  → create/edit named pieces from source command ranges
  → add explicit anchor-to-anchor closure seams where needed
  → assign each piece by adding its ref to an ordered physical step
  → inspect live compiled previews and validation
  → save reviewing recipe, or after visual verification clear blocker → approve
```

The workbench starts with a single selected source contour. It displays:

1. The original source contour and a stable indexed command list. Each command
   has its normalized cache index, type, coordinates/control points, and
   stable source contour hash context.
2. Piece cards with command-range selection, a token sequence, explicit seam
   controls that only offer anchors from the selected contour, and a manually
   selected physical-step owner derived from `ReviewedStep.geometry`.
3. Live previews of the original source contour; separately colored split
   pieces; each compiled physical step; the combined per-jamo colored result;
   one-color reconstruction; and source/reconstruction overlay.
4. A coverage ledger showing every source command as exactly once owned,
   uncovered, or duplicate. Synthetic seams are displayed separately and are
   never counted as source-command ownership.

Changing any whole-contour assignment, piece range, seam, or piece reference
recompiles the same exportable geometry used by the existing physical-step,
colored-result, reconstruction, and overlay panels. The workbench stores no
alternate preview paths.

### Validation invariants

V2 blocks saving an apparently resolved recipe or approving a review when any
of the following fails:

- The source fingerprint, source glyph hash, selected contour ID, and selected
  contour command hash match the active cache exactly.
- A range is non-empty, ordered, and within the selected contour's stable
  command indexes.
- Every source command in a replaced contour is covered exactly once across
  that recipe's pieces; no command is omitted or owned by multiple pieces.
- Every anchor names the selected source contour, a valid command index, and a
  point available on that command. Closure seams are explicit and only use
  valid source anchors.
- A replaced source contour has no whole-contour ref. A non-replaced contour
  has exactly one whole-contour ref. Each recipe piece has exactly one
  `ReviewedStep.geometry` ref.
- The reviewed step array exactly matches the physical typing count, order,
  and jamo labels; every step compiles to non-empty geometry.
- Every compiled path is valid SVG with `fill-rule="evenodd"`; the ordered
  paths reconstruct the source under deterministic geometric/raster
  comparison, allowing only declared interior seams.
- `needs-split` prevents approval until explicitly cleared by the reviewer,
  even if all structural and reconstruction checks pass.

The workbench may save a clearly marked unresolved review with
`needs-split`, but it must preserve blockers and must never allow runtime
export or approval from that state.

### Smallest useful implementation scope

The first implementation is intentionally narrow:

1. Add V2 review/recipe/shard/manifest schemas and the deterministic V1→V2
   migration command with migration diagnostics.
2. Upgrade the compiler and validator so ownership is derived solely from
   `ReviewedStep.geometry`.
3. Add one dev-only split workbench for one selected source contour: indexed
   command inspection, range tokens, existing-anchor closure seams, manual
   piece-to-step assignment, live compiled previews, coverage ledger, and
   save/approval gating.
4. Surface the note-without-blocker consistency warning and require an
   explicit reviewer action; do not mutate `낪` or `닶` during migration.
5. Verify the migrated `값` recipe and use `낪`/`닶` as the first manual mixed
   family reviews, then use `굵`, `굸`, `귟`, and `귌` to assess compact cases.

### Intentionally deferred

- Automatic split-boundary discovery, automatic ownership inference, template
  propagation, and a generic boolean geometry splitter.
- Multi-contour split editing in one transaction beyond selecting one contour
  at a time; multiple independent recipes may still compose a glyph.
- Automatic conversion of review-note prose into blockers or geometry.
- Full-block queue expansion, dataset generation, runtime SVG delivery, and
  production renderer integration.
