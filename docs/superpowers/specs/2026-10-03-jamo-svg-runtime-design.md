# Jamo SVG Runtime — Design

Date: 2026-10-03
Status: Draft for review
Related: `docs/research/JAMO_SVG_TAGGER_DESIGN.md` §9–§10, DEC-037, DEC-038, DEC-039 (to be added)

## 1. Goal

Prove the full path from reviewed data to the learner screen before more
glyphs are reviewed:

```text
approved reviews → dataset compiler → compact runtime shards
  → HangulTarget → JamoSvgHangulTarget (per-step SVG coloring)
  → Lesson / Review / One-page learning player
```

The trial uses every approved review that exists when the compiler runs
(1,858 of 2,011 queued syllables at the time of writing).

Success means: with the feature flag on, typing a target whose syllables all
have approved data shows Pretendard SVG glyphs whose typed-key steps change
color in step with the typing session; any other target renders exactly as
today with the legacy Canvas renderer, and nothing breaks.

## 2. Decisions captured from design review

| Topic         | Decision                                                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fallback      | All-or-nothing per target. SVG only when every syllable group in the target has approved data; otherwise the legacy Canvas renders the whole target. Pretendard SVG and Noto Canvas are never mixed in one target. |
| Rollout       | Behind a feature flag; off by default in production.                                                                                                                                                               |
| Flag          | `VITE_JAMO_SVG_RENDERER=1` sets the default. In development builds only, a `localStorage` override can switch it on or off without a rebuild.                                                                      |
| Data delivery | 19 shards by choseong, files `00.json`–`18.json`. Load only the shards the current target needs; no preloading.                                                                                                    |
| Shard naming  | Numeric index derived from Hangul decomposition via one shared helper, `getChoseongShardIndex(syllable)`. File names never contain Hangul.                                                                         |
| Storage       | Compiled shards are committed under `public/jamo-svg/pretendard-600/`. Build and deploy never run the compiler or need the font or review tooling.                                                                 |
| Loading state | Blank tiles of the normal size until the renderer is chosen; Canvas after a 1,500 ms timeout. The choice is final for that target.                                                                                 |
| Integration   | A wrapper, `HangulTarget`, with the same props as `DecomposedHangulTarget`. Call sites change only their import and element name.                                                                                  |

Out of scope: per-syllable fallback, retiring the Canvas renderer, enabling
the renderer for learners, changes to the typing engine, changes to
`DecomposedHangulTarget`, animation, and any Firestore or persistence work.

## 3. Components

### 3.1 Shared shard helper (domain)

`src/domain/korean/hangul.ts` adds:

```ts
/** Choseong index 0–18 of a precomposed syllable 가–힣; undefined otherwise. */
export function getChoseongShardIndex(syllable: string): number | undefined
```

It returns `Math.floor((codePoint - 0xac00) / 588)` for a single character in
U+AC00–U+D7A3 and `undefined` for anything else (standalone jamo, Latin,
punctuation, spaces, multi-character strings). The compiler and the runtime
loader both use this function, so shard selection has one definition.

A second helper formats the file name: `shardFileName(index)` returns
`String(index).padStart(2, '0') + '.json'`.

### 3.2 Dataset compiler (tooling)

- `tools/jamo-svg/runtime-dataset.ts` — pure function
  `buildRuntimeShards(input) → Map<shardIndex, RuntimeJamoSvgShard>` plus a
  deterministic serializer.
- `scripts/compile-jamo-svg-runtime.ts` — reads the review manifest and
  shards, re-extracts each approved glyph, calls the builder, and writes
  `public/jamo-svg/pretendard-600/00.json`–`18.json`.
- `package.json`: `"jamo-svg:compile-runtime": "tsx scripts/compile-jamo-svg-runtime.ts"`.
- `tools/jamo-svg/extract.ts` exports the font's `unitsPerEm` (for example,
  by exporting `loadFont` or a small `loadFontMetrics`).

Rules:

1. Only reviews with `status: 'approved'` are compiled. All other statuses
   are skipped.
2. Each approved review must pass `validateReview` against a freshly
   extracted glyph whose font and step-algorithm fingerprint match the
   review manifest. Any failure stops the run with an error naming the
   syllable; nothing is written.
3. `paths` come from the existing `compileReview`, in typed-key order
   (DEC-037), as `{ jamo, d }`.
4. Numbers in `d` are rounded to one decimal place, and trailing `.0` is
   dropped. The same rounding is applied every run.
5. `width` is the glyph's advance width.
6. All 19 files are written every run, including empty shards
   (`glyphs: {}`), so the runtime never sees a 404 for a valid index.
7. Output is deterministic: glyph keys sorted by code point, a fixed key
   order in every object, no timestamps, and a trailing newline. Each glyph
   is written as compact JSON on its own line inside `glyphs`, so a newly
   approved syllable shows as one added line in a Git diff.

Shard file shape:

```ts
type RuntimeJamoSvgGlyph = {
  width: number
  paths: Array<{ jamo: string; d: string }>
}

type RuntimeJamoSvgDataset = Record<string, RuntimeJamoSvgGlyph>

type RuntimeJamoSvgShard = {
  datasetSchemaVersion: 1
  fontSha256: string
  /** Height of every glyph's viewBox; all glyphs share one em box. */
  unitsPerEm: number
  glyphs: RuntimeJamoSvgDataset
}
```

The glyph level keeps the exact minimal shape from the design doc. The
shard level adds only what the renderer and the integrity checks need.
No review state, contours, source commands, recipes, or queue data are
emitted.

Measured size at 1,858 glyphs: about 1.23 MB raw and 343 KB gzip in total,
or about 18 KB gzip per shard. At full coverage (11,172) this is estimated at
about 7.4 MB raw and 2 MB gzip, or about 100 KB gzip per shard.

### 3.3 Runtime dataset loader (infrastructure)

`src/infrastructure/jamo-svg/jamo-svg-dataset.ts`:

```ts
type LoadedJamoSvgGlyphs = {
  unitsPerEm: number
  glyphs: Map<string, RuntimeJamoSvgGlyph>
}

export function loadJamoSvgGlyphs(
  syllables: string[],
): Promise<LoadedJamoSvgGlyphs | undefined>
```

- Derives the unique shard indexes with `getChoseongShardIndex`.
- URL: `${import.meta.env.BASE_URL}jamo-svg/pretendard-600/${shardFileName(i)}`.
- Keeps one module-level `Map<number, Promise<RuntimeJamoSvgShard>>`.
  Concurrent and later calls for the same shard share that promise, so a
  shard is fetched at most once per page load while it succeeds.
- A shard load fails on: non-2xx HTTP, invalid JSON, or
  `datasetSchemaVersion !== 1`. A failed promise is removed from the cache
  so a later target can retry.
- The result is `undefined` when any needed shard fails, or when the needed
  shards disagree on `fontSha256` or `unitsPerEm`.
- Otherwise the result holds only the requested syllables that exist in
  their shards. A missing syllable is absent from the map; the caller
  decides the fallback.
- A test-only reset function clears the cache.

### 3.4 Feature flag

`src/features/typing/jamo-svg-flag.ts`:

```ts
export function isJamoSvgRendererEnabled(): boolean
```

- Default: `import.meta.env.VITE_JAMO_SVG_RENDERER === '1'`.
- Only when `import.meta.env.DEV` is true: the `localStorage` key
  `jamozy:jamo-svg-renderer` with value `'1'` or `'0'` overrides the default.
  Storage access is wrapped in `try/catch`; any error means no override.
- Production builds ignore `localStorage`.
- `.env.example` gains `VITE_JAMO_SVG_RENDERER=` (empty means off).

The flag is read once when `HangulTarget` mounts; a page reload applies a
changed override.

### 3.5 SVG renderer

`src/features/typing/JamoSvgHangulTarget.tsx`, props
`{ session, glyphs, unitsPerEm, className? }`:

- Groups `session.expectedKeys` by `syllableIndex`, as the Canvas renderer
  does.
- Renders one `<svg viewBox="0 0 {width} {unitsPerEm}">` per syllable,
  inside a tile with the same size and frame as the Canvas tile
  (`h-26 w-26`, same border and background).
- Renders one `<path d>` per step. Step _n_ of the syllable pairs with
  `paths[n]`; its global key index sets the fill with the Canvas colors:
  `correct #20b981` (index < `keyIndex`), `current #e990b6`
  (index = `keyIndex`), `pending #c7c3bc` (index > `keyIndex`).
- The outer element keeps `role="img"` and `aria-label={targetText}`; each
  `<svg>` is `aria-hidden`.
- Rendering is synchronous from props; a key press only changes fills.

### 3.6 Wrapper

`src/features/typing/HangulTarget.tsx`, props
`{ session: TypingSessionState; className?: string }` (identical to
`DecomposedHangulTarget`).

- Flag off: renders `DecomposedHangulTarget` directly.
- Flag on: runs the selection flow in §4 and renders blank tiles, the SVG
  renderer, or `DecomposedHangulTarget`.

### 3.7 Call sites

`LessonTypingSession.tsx`, `ReviewTypingSession.tsx`, and
`OnePageLearningPlayer.tsx` replace the `DecomposedHangulTarget` import and
element with `HangulTarget`. No other change to these components or their
props.

## 4. Selection flow and timing

The flow runs when `session.targetText` changes (and on mount). `keyIndex`
changes never trigger it.

1. Group `session.expectedKeys` by `syllableIndex`. If any group's character
   is not a precomposed syllable 가–힣 (a `literal` key, a standalone jamo,
   or anything else), choose **Canvas** immediately; do not fetch.
2. Otherwise show blank tiles (one per group, normal tile size) and call
   `loadJamoSvgGlyphs` with the target's syllables.
3. Race the load against a 1,500 ms timer.
4. Choose **SVG** only if the load resolves first, every syllable is present,
   and every syllable passes the step check: the glyph has exactly as many
   paths as the group has expected keys, and each `paths[n].jamo` equals the
   group's `n`-th `ExpectedKey.jamo`.
5. In every other case (timeout, failed load, missing glyph, failed step
   check) choose **Canvas** for the whole target.
6. The choice is final for that target. A shard that arrives after the
   timeout stays cached for later targets but does not swap this one.
7. If the target changes before the choice, the stale result is discarded
   (cancellation flag in the effect cleanup).

## 5. Error handling

- Learners never see an error message; every failure path is a Canvas
  render.
- In development builds, `console.warn` states why SVG was not used: the
  shard index that failed, the missing syllables, the step-check mismatch,
  or the timeout.
- Production builds do not log.

## 6. Testing

Vitest and React Testing Library. No image snapshot tests.

- `getChoseongShardIndex` and `shardFileName`: 가 → 0, 까 → 1, 꿱 → 1,
  힣 → 18; ㄱ, `A`, a space, and `가나` → `undefined`; 0 → `00.json`,
  18 → `18.json`.
- Compiler (`tools/jamo-svg/runtime-dataset.test.ts`): only approved reviews
  are included; keys are sorted by code point; two runs give byte-identical
  output; numbers are rounded to one decimal; all 19 shards are produced,
  including empty ones; an approved review that fails validation stops the
  run.
- Drift guard: compile the current approved reviews in memory and compare
  with the committed `public/jamo-svg/pretendard-600/*.json`. A missed
  `pnpm jamo-svg:compile-runtime` fails the test.
- Loader (mocked `fetch`): several syllables in one shard cause one fetch;
  concurrent calls share one promise; a failed shard is not cached and the
  next call fetches again; schema-version and font or em mismatches return
  `undefined`; missing syllables are absent from the map.
- Flag: production ignores `localStorage`; development honors `'1'` and
  `'0'`; a throwing `localStorage` means no override.
- `HangulTarget` (fake timers, mocked loader):
  - flag off renders Canvas;
  - complete data shows blank tiles, then SVG with fills that follow
    `keyIndex`;
  - one missing syllable renders Canvas for the whole target;
  - a literal or standalone jamo renders Canvas without calling the loader;
  - a timeout renders Canvas and does not switch to SVG when data arrives
    later;
  - a step-check mismatch renders Canvas;
  - a target change discards the stale result.
- Existing Lesson, Review, and player tests keep passing; only their imports
  change if they reference the renderer.

## 7. Documentation

- `docs/DECISIONS.md`: DEC-039 records the choseong shard layout and numeric
  names, committed compiled shards, the flag, the all-or-nothing fallback,
  blank tiles with a timeout, and the no-mixed-fonts rule, with rationale.
- `docs/research/JAMO_SVG_TAGGER_DESIGN.md` §9 and §10: point the
  "separately designed and approved" runtime note and the deferred
  partitioning item to DEC-039 and this spec.
- `AGENTS.md`: add `pnpm jamo-svg:compile-runtime` and
  `VITE_JAMO_SVG_RENDERER`.
- `.env.example`: add `VITE_JAMO_SVG_RENDERER=`.
- After implementation: `docs/PROGRESS.md`, `README.md`, and
  `docs/COMPLETE-LOG.md`.

## 8. Workflow after more approvals

1. Approve glyphs in the Tagger.
2. Run `pnpm jamo-svg:compile-runtime`.
3. Commit the reviews and the regenerated shards together. The drift-guard
   test fails if the shards are not regenerated.
