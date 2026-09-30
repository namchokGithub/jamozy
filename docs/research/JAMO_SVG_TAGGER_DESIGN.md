# Jamo SVG Tagger v1 design

Status: design only, 2026-09-30. This document specifies a development-only
review tool. It does not authorize implementation, production SVG generation,
or any change to the existing Canvas renderer.

Read [the structural analysis](HANGUL_SVG_ANALYSIS.md) first. It is the source
of truth for font choice, physical-jamo rules, measured full-block results,
PoC findings, and project constraints. This document designs the next tool
needed to act on those findings.

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
  physicalStepAlgorithm: 1
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
```

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
shard is valid only when it is absent from the manifest; an empty chosen-initial
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
