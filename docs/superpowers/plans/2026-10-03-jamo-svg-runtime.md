# Jamo SVG Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compile approved Jamo SVG reviews into 19 committed runtime shards and render typing targets with per-step SVG coloring behind a feature flag, falling back to the legacy Canvas for the whole target.

**Architecture:** A tooling compiler (`tools/jamo-svg/runtime-dataset.ts`) turns approved reviews into deterministic choseong shards under `public/jamo-svg/pretendard-600/`. A runtime loader (`src/infrastructure/jamo-svg/`) fetches only the needed shards with in-memory caching. A wrapper, `HangulTarget`, with the same props as `DecomposedHangulTarget`, chooses SVG or Canvas per target.

**Tech Stack:** TypeScript, React 19, Vite, Vitest 5 + React Testing Library (jsdom), tsx scripts, opentype.js (tooling only).

**Spec:** `docs/superpowers/specs/2026-10-03-jamo-svg-runtime-design.md`

## Global Constraints

- Never run `git commit` (AGENTS.md). Each task ends with a suggested commit message only.
- Glyph shape is exactly `{ width: number; paths: Array<{ jamo: string; d: string }> }`.
- Shard files: `public/jamo-svg/pretendard-600/00.json`–`18.json`; all 19 written every run.
- Shard index: `Math.floor((codePoint - 0xac00) / 588)` via `getChoseongShardIndex`; file name via `shardFileName`.
- Shard metadata: `datasetSchemaVersion: 1`, `fontSha256`, `unitsPerEm`.
- Path numbers rounded to one decimal place.
- Flag: `VITE_JAMO_SVG_RENDERER === '1'`; in DEV only, `localStorage['jamozy:jamo-svg-renderer']` `'1'`/`'0'` overrides.
- Load timeout: 1,500 ms; the choice is final per target.
- SVG only when every syllable group is a precomposed syllable with approved data and matching step jamo; otherwise Canvas for the whole target. Never mix SVG and Canvas in one target.
- Step colors: `correct #20b981`, `current #e990b6`, `pending #c7c3bc`.
- Call sites (`LessonTypingSession`, `ReviewTypingSession`, `OnePageLearningPlayer`) change only import and element name.
- Testing policy: tests for logic; no tests for visual-only styling.

## Review Focus

- A target that contains a space (multi-word target) has a `literal` key for the space, so it always renders Canvas under the spec's rule. Expected per spec; pinned by a test in Task 6 so a later change is deliberate.
- A review approved after the last compile: the drift-guard test fails until `pnpm jamo-svg:compile-runtime` runs. Pinned in Task 3.
- `pnpm format` (`prettier --write .`) would reformat the generated JSON and break the drift guard. Task 3 adds `public/jamo-svg/` to `.prettierignore`.
- A shard request that fails once must not poison later targets. Pinned in Task 4 (failed promise removed).
- A completed session (`keyIndex === expectedKeys.length`) must show every step as `correct`. Pinned in Task 6.

---

### Task 1: Shard index helper and runtime types

**Files:**
- Modify: `src/domain/korean/hangul.ts` (append after `composeSyllable`)
- Create: `src/domain/korean/jamo-svg-runtime.ts`
- Test: `src/domain/korean/hangul.test.ts` (append)

**Interfaces:**
- Produces: `getChoseongShardIndex(syllable: string): number | undefined`, `shardFileName(index: number): string`, `CHOSEONG_SHARD_COUNT: number` (19), types `RuntimeJamoSvgGlyph`, `RuntimeJamoSvgDataset`, `RuntimeJamoSvgShard`.

- [ ] **Step 1: Write the failing test** — append to `src/domain/korean/hangul.test.ts` (add the new names to its existing import from `./hangul`):

```ts
describe('getChoseongShardIndex', () => {
  test('derives the choseong index of a precomposed syllable', () => {
    expect(getChoseongShardIndex('가')).toBe(0)
    expect(getChoseongShardIndex('까')).toBe(1)
    expect(getChoseongShardIndex('꿱')).toBe(1)
    expect(getChoseongShardIndex('나')).toBe(2)
    expect(getChoseongShardIndex('힣')).toBe(18)
  })

  test('returns undefined for anything that is not one precomposed syllable', () => {
    for (const value of ['ㄱ', 'A', ' ', '', '가나'])
      expect(getChoseongShardIndex(value)).toBeUndefined()
  })

  test('formats two-digit shard file names', () => {
    expect(CHOSEONG_SHARD_COUNT).toBe(19)
    expect(shardFileName(0)).toBe('00.json')
    expect(shardFileName(18)).toBe('18.json')
  })
})
```

If `hangul.test.ts` does not import `describe`/`test`/`expect`, rely on Vitest globals (`globals: true` in `vite.config.ts`).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/domain/korean/hangul.test.ts`
Expected: FAIL — `getChoseongShardIndex` is not exported.

- [ ] **Step 3: Implement** — append to `src/domain/korean/hangul.ts`:

```ts
/** Number of runtime Jamo SVG shards: one per choseong. */
export const CHOSEONG_SHARD_COUNT = CHOSEONG_LIST.length

/** Choseong index 0–18 of one precomposed syllable 가–힣; undefined otherwise. */
export function getChoseongShardIndex(syllable: string): number | undefined {
  if (Array.from(syllable).length !== 1) return undefined
  const offset = (syllable.codePointAt(0) ?? 0) - HANGUL_BASE
  if (offset < 0 || offset >= SYLLABLE_COUNT) return undefined
  return Math.floor(offset / (JUNGSEONG_COUNT * JONGSEONG_COUNT))
}

export function shardFileName(index: number): string {
  return `${String(index).padStart(2, '0')}.json`
}
```

Create `src/domain/korean/jamo-svg-runtime.ts`:

```ts
/** One syllable: its advance width and one path per typed key, in typing order. */
export type RuntimeJamoSvgGlyph = {
  width: number
  paths: Array<{ jamo: string; d: string }>
}

export type RuntimeJamoSvgDataset = Record<string, RuntimeJamoSvgGlyph>

/** A choseong shard file under public/jamo-svg/pretendard-600/. */
export type RuntimeJamoSvgShard = {
  datasetSchemaVersion: 1
  fontSha256: string
  /** Height of every glyph's viewBox; all glyphs share one em box. */
  unitsPerEm: number
  glyphs: RuntimeJamoSvgDataset
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/domain/korean/hangul.test.ts`
Expected: PASS.

- [ ] **Step 5: Suggest commit message**

`feat(jamo-svg): add choseong shard index helper and runtime dataset types`

---

### Task 2: Runtime dataset compiler core

**Files:**
- Modify: `tools/jamo-svg/extract.ts` (add export after `fontFingerprint`)
- Create: `tools/jamo-svg/runtime-dataset.ts`
- Test: `tools/jamo-svg/runtime-dataset.test.ts`

**Interfaces:**
- Consumes: `getChoseongShardIndex`, `CHOSEONG_SHARD_COUNT`, `RuntimeJamoSvgShard` (Task 1); `compileReview`, `validateReview` (`./compile`); `extractGlyph` (`./extract`); `seedReview` (`./seed`, tests only).
- Produces:
  - `fontUnitsPerEm(fontPath?: string): Promise<number>` in `extract.ts`
  - `type ApprovedEntry = { glyph: CachedGlyph; review: GlyphReview }`
  - `roundPathNumbers(d: string): string`
  - `buildRuntimeShards(entries: ApprovedEntry[], meta: { fontSha256: string; unitsPerEm: number }): RuntimeJamoSvgShard[]` (length 19)
  - `serializeRuntimeShard(shard: RuntimeJamoSvgShard): string`
  - `compileRuntimeShards(reviewsRoot: string): Promise<string[]>` (19 serialized shards, index = shard index)

- [ ] **Step 1: Write the failing test** — create `tools/jamo-svg/runtime-dataset.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { extractGlyph } from './extract'
import {
  buildRuntimeShards,
  roundPathNumbers,
  serializeRuntimeShard,
  type ApprovedEntry,
} from './runtime-dataset'
import { seedReview } from './seed'

const META = { fontSha256: 'f', unitsPerEm: 2048 }
const entry = async (
  syllable: string,
  status: 'approved' | 'reviewing' = 'approved',
): Promise<ApprovedEntry> => ({
  glyph: await extractGlyph(syllable),
  review: { ...(await seedReview(syllable)), status },
})

describe('runtime dataset compiler', () => {
  test('compiles only approved reviews into 19 choseong shards sorted by code point', async () => {
    const shards = buildRuntimeShards(
      [
        await entry('거'),
        await entry('나'),
        await entry('가'),
        await entry('카', 'reviewing'),
      ],
      META,
    )
    expect(shards).toHaveLength(19)
    expect(Object.keys(shards[0].glyphs)).toEqual(['가', '거'])
    expect(Object.keys(shards[2].glyphs)).toEqual(['나'])
    expect(shards[15].glyphs).toEqual({})
    expect(shards[0]).toMatchObject({
      datasetSchemaVersion: 1,
      fontSha256: 'f',
      unitsPerEm: 2048,
    })
  })

  test('keeps the minimal glyph shape with one path per typed key', async () => {
    const [shard] = buildRuntimeShards([await entry('가')], META)
    const glyph = shard.glyphs['가']
    expect(Object.keys(glyph)).toEqual(['width', 'paths'])
    expect(glyph.width).toBe(1770)
    expect(glyph.paths.map(({ jamo }) => jamo)).toEqual(['ㄱ', 'ㅏ'])
    expect(glyph.paths.every(({ d }) => d.startsWith('M'))).toBe(true)
  })

  test('rounds path numbers to one decimal place', () => {
    expect(roundPathNumbers('M1.26 -0.04 Q468.5 568.56 10 2')).toBe(
      'M1.3 0 Q468.5 568.6 10 2',
    )
  })

  test('stops when an approved review fails validation', async () => {
    const broken = await entry('가')
    broken.review.steps[1].geometry = []
    expect(() => buildRuntimeShards([broken], META)).toThrow(
      /가 is approved but fails validation/,
    )
  })

  test('serializes deterministically with one glyph per line', async () => {
    const forward = buildRuntimeShards(
      [await entry('가'), await entry('거')],
      META,
    )
    const backward = buildRuntimeShards(
      [await entry('거'), await entry('가')],
      META,
    )
    const text = serializeRuntimeShard(forward[0])
    expect(text).toBe(serializeRuntimeShard(backward[0]))
    expect(JSON.parse(text)).toEqual(forward[0])
    expect(text.split('\n').filter((line) => line.startsWith('    "'))).toHaveLength(2)
    expect(serializeRuntimeShard(forward[5])).toBe(
      '{\n  "datasetSchemaVersion": 1,\n  "fontSha256": "f",\n  "unitsPerEm": 2048,\n  "glyphs": {}\n}\n',
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tools/jamo-svg/runtime-dataset.test.ts`
Expected: FAIL — cannot resolve `./runtime-dataset`.

- [ ] **Step 3: Implement**

Add to `tools/jamo-svg/extract.ts` directly after `fontFingerprint`:

```ts
export async function fontUnitsPerEm(fontPath = FONT_PATH) {
  return (await loadFont(fontPath)).font.unitsPerEm
}
```

Create `tools/jamo-svg/runtime-dataset.ts`:

```ts
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  CHOSEONG_SHARD_COUNT,
  getChoseongShardIndex,
} from '../../src/domain/korean/hangul'
import type { RuntimeJamoSvgShard } from '../../src/domain/korean/jamo-svg-runtime'
import { compileReview, validateReview } from './compile'
import { extractGlyph, fontUnitsPerEm } from './extract'
import type { ReviewManifest, ReviewShard } from './review-store'
import type { CachedGlyph, GlyphReview } from './types'

export type ApprovedEntry = { glyph: CachedGlyph; review: GlyphReview }

export function roundPathNumbers(d: string) {
  return d.replace(/-?\d+(?:\.\d+)?/g, (value) =>
    String(Math.round(Number(value) * 10) / 10 || 0),
  )
}

/** Builds all 19 runtime shards from approved reviews (DEC-039). */
export function buildRuntimeShards(
  entries: ApprovedEntry[],
  meta: { fontSha256: string; unitsPerEm: number },
): RuntimeJamoSvgShard[] {
  const shards = Array.from(
    { length: CHOSEONG_SHARD_COUNT },
    (): RuntimeJamoSvgShard => ({
      datasetSchemaVersion: 1,
      fontSha256: meta.fontSha256,
      unitsPerEm: meta.unitsPerEm,
      glyphs: {},
    }),
  )
  const sorted = [...entries].sort(
    (a, b) =>
      (a.glyph.syllable.codePointAt(0) ?? 0) -
      (b.glyph.syllable.codePointAt(0) ?? 0),
  )
  for (const { glyph, review } of sorted) {
    if (review.status !== 'approved') continue
    const index = getChoseongShardIndex(glyph.syllable)
    if (index === undefined)
      throw new Error(`${glyph.syllable} is not a Hangul syllable.`)
    const { blockers } = validateReview(glyph, review)
    if (blockers.length)
      throw new Error(
        `${glyph.syllable} is approved but fails validation: ${blockers.join(', ')}`,
      )
    const compiled = compileReview(glyph, review)
    shards[index].glyphs[glyph.syllable] = {
      width: compiled.width,
      paths: compiled.paths.map(({ jamo, d }) => ({
        jamo,
        d: roundPathNumbers(d),
      })),
    }
  }
  return shards
}

/** Stable text: fixed key order, one glyph per line, trailing newline. */
export function serializeRuntimeShard(shard: RuntimeJamoSvgShard) {
  const lines = Object.entries(shard.glyphs).map(
    ([syllable, { width, paths }]) =>
      `    ${JSON.stringify(syllable)}: ${JSON.stringify({
        width,
        paths: paths.map(({ jamo, d }) => ({ jamo, d })),
      })}`,
  )
  const glyphs = lines.length ? `{\n${lines.join(',\n')}\n  }` : '{}'
  return `{\n  "datasetSchemaVersion": ${shard.datasetSchemaVersion},\n  "fontSha256": ${JSON.stringify(shard.fontSha256)},\n  "unitsPerEm": ${shard.unitsPerEm},\n  "glyphs": ${glyphs}\n}\n`
}

/** Reads every approved review and returns the 19 serialized shards. */
export async function compileRuntimeShards(reviewsRoot: string) {
  const manifest = JSON.parse(
    await readFile(join(reviewsRoot, 'manifest.json'), 'utf8'),
  ) as ReviewManifest
  const entries: ApprovedEntry[] = []
  for (const item of manifest.shards) {
    const shard = JSON.parse(
      await readFile(join(reviewsRoot, item.file), 'utf8'),
    ) as ReviewShard
    for (const review of Object.values(shard.reviews)) {
      if (review.status !== 'approved') continue
      const glyph = await extractGlyph(review.syllable)
      if (
        glyph.extraction.fontSha256 !== manifest.activeFontFingerprint ||
        glyph.extraction.physicalStepAlgorithm !==
          manifest.physicalStepAlgorithmVersion
      )
        throw new Error(
          `${review.syllable}: font or step-algorithm fingerprint differs from the review manifest; migrate reviews first.`,
        )
      entries.push({ glyph, review })
    }
  }
  return buildRuntimeShards(entries, {
    fontSha256: manifest.activeFontFingerprint,
    unitsPerEm: await fontUnitsPerEm(),
  }).map(serializeRuntimeShard)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tools/jamo-svg/runtime-dataset.test.ts`
Expected: PASS. If `seedReview('거')` does not validate (seed ownership is a heuristic), replace `'거'` with another ㄱ-initial simple syllable whose seed validates (for example `'고'`) in both tests and the expected key list.

- [ ] **Step 5: Suggest commit message**

`feat(jamo-svg): compile approved reviews into deterministic runtime shards`

---

### Task 3: Compile script, committed shards, drift guard

**Files:**
- Create: `scripts/compile-jamo-svg-runtime.ts`
- Modify: `package.json` (scripts, after `jamo-svg:audit`)
- Create: `.prettierignore`
- Create (generated): `public/jamo-svg/pretendard-600/00.json`–`18.json`
- Test: `tools/jamo-svg/runtime-dataset-committed.test.ts`

**Interfaces:**
- Consumes: `compileRuntimeShards` (Task 2), `shardFileName` (Task 1).
- Produces: `pnpm jamo-svg:compile-runtime`; committed shard files read by Task 4 at runtime.

- [ ] **Step 1: Write the failing test** — create `tools/jamo-svg/runtime-dataset-committed.test.ts`:

```ts
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { shardFileName } from '../../src/domain/korean/hangul'
import { compileRuntimeShards } from './runtime-dataset'

// Guards the committed runtime shards: approving a review without running
// `pnpm jamo-svg:compile-runtime` fails here.
test('committed runtime shards match the approved reviews', async () => {
  const texts = await compileRuntimeShards('tools/jamo-svg/reviews/pretendard-600')
  const committed = await Promise.all(
    texts.map((_, index) =>
      readFile(
        join('public/jamo-svg/pretendard-600', shardFileName(index)),
        'utf8',
      ).catch(() => ''),
    ),
  )
  const stale = texts.flatMap((text, index) =>
    text === committed[index] ? [] : [shardFileName(index)],
  )
  expect(stale, 'Run pnpm jamo-svg:compile-runtime').toEqual([])
}, 180_000)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tools/jamo-svg/runtime-dataset-committed.test.ts`
Expected: FAIL — `stale` lists all 19 files.

- [ ] **Step 3: Implement**

Create `scripts/compile-jamo-svg-runtime.ts`:

```ts
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { shardFileName } from '../src/domain/korean/hangul'
import { compileRuntimeShards } from '../tools/jamo-svg/runtime-dataset'

// Compiles approved reviews into the runtime shards the app fetches (DEC-039).
// Every shard is compiled before any file is written, so a failure writes nothing.
const root = process.cwd()
const outDir = join(root, 'public/jamo-svg/pretendard-600')
const texts = await compileRuntimeShards(
  join(root, 'tools/jamo-svg/reviews/pretendard-600'),
)
await mkdir(outDir, { recursive: true })
await Promise.all(
  texts.map((text, index) => writeFile(join(outDir, shardFileName(index)), text)),
)
const glyphCount = texts.reduce(
  (sum, text) =>
    sum + Object.keys((JSON.parse(text) as { glyphs: object }).glyphs).length,
  0,
)
console.log(
  `Wrote ${texts.length} shards with ${glyphCount} glyphs to public/jamo-svg/pretendard-600.`,
)
```

Add to `package.json` `scripts`, after `"jamo-svg:audit"` (add a comma to the previous line):

```json
"jamo-svg:compile-runtime": "tsx scripts/compile-jamo-svg-runtime.ts"
```

Create `.prettierignore`:

```text
# Generated by pnpm jamo-svg:compile-runtime; byte-exact output is test-guarded.
public/jamo-svg/
```

Generate the shards:

Run: `pnpm jamo-svg:compile-runtime`
Expected: `Wrote 19 shards with <N> glyphs …` where N equals the current approved count (1,858 at spec time).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tools/jamo-svg/runtime-dataset-committed.test.ts && npx prettier --check .prettierignore public/jamo-svg`
Expected: test PASS; prettier reports the JSON files as ignored (no warnings).

- [ ] **Step 5: Suggest commit message**

`feat(jamo-svg): add compile-runtime script and generated runtime shards`

---

### Task 4: Runtime shard loader

**Files:**
- Create: `src/infrastructure/jamo-svg/jamo-svg-dataset.ts`
- Test: `src/infrastructure/jamo-svg/jamo-svg-dataset.test.ts`

**Interfaces:**
- Consumes: `getChoseongShardIndex`, `shardFileName` (Task 1), `RuntimeJamoSvgGlyph`, `RuntimeJamoSvgShard` (Task 1).
- Produces:
  - `type LoadedJamoSvgGlyphs = { unitsPerEm: number; glyphs: Map<string, RuntimeJamoSvgGlyph> }`
  - `loadJamoSvgGlyphs(syllables: string[]): Promise<LoadedJamoSvgGlyphs | undefined>`
  - `resetJamoSvgDatasetCacheForTests(): void`

- [ ] **Step 1: Write the failing test** — create `src/infrastructure/jamo-svg/jamo-svg-dataset.test.ts`:

```ts
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  loadJamoSvgGlyphs,
  resetJamoSvgDatasetCacheForTests,
} from './jamo-svg-dataset'

const glyph = {
  width: 1770,
  paths: [
    { jamo: 'ㄱ', d: 'M0 0' },
    { jamo: 'ㅏ', d: 'M1 1' },
  ],
}
const shard = (glyphs: object, overrides: object = {}) => ({
  datasetSchemaVersion: 1,
  fontSha256: 'f',
  unitsPerEm: 2048,
  glyphs,
  ...overrides,
})
const respond = (body: unknown, ok = true) =>
  Promise.resolve({
    ok,
    status: ok ? 200 : 404,
    json: () => Promise.resolve(body),
  })

beforeEach(() => {
  resetJamoSvgDatasetCacheForTests()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('fetches one shard for syllables that share a choseong', async () => {
  const fetchMock = vi.fn(() => respond(shard({ 가: glyph, 거: glyph })))
  vi.stubGlobal('fetch', fetchMock)
  const loaded = await loadJamoSvgGlyphs(['가', '거', '가'])
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock).toHaveBeenCalledWith('/jamo-svg/pretendard-600/00.json')
  expect(loaded?.unitsPerEm).toBe(2048)
  expect([...(loaded?.glyphs.keys() ?? [])]).toEqual(['가', '거'])
})

test('shares one request between concurrent and later calls', async () => {
  const fetchMock = vi.fn(() => respond(shard({ 가: glyph })))
  vi.stubGlobal('fetch', fetchMock)
  await Promise.all([loadJamoSvgGlyphs(['가']), loadJamoSvgGlyphs(['가'])])
  await loadJamoSvgGlyphs(['가'])
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('does not cache a failed shard, so a later call retries', async () => {
  const fetchMock = vi
    .fn()
    .mockImplementationOnce(() => respond({}, false))
    .mockImplementation(() => respond(shard({ 가: glyph })))
  vi.stubGlobal('fetch', fetchMock)
  expect(await loadJamoSvgGlyphs(['가'])).toBeUndefined()
  expect((await loadJamoSvgGlyphs(['가']))?.glyphs.has('가')).toBe(true)
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test('rejects an unsupported schema version', async () => {
  vi.stubGlobal('fetch', vi.fn(() => respond(shard({ 가: glyph }, { datasetSchemaVersion: 2 }))))
  expect(await loadJamoSvgGlyphs(['가'])).toBeUndefined()
})

test('rejects shards built from different fonts', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      respond(
        url.endsWith('00.json')
          ? shard({ 가: glyph })
          : shard({ 나: glyph }, { fontSha256: 'other' }),
      ),
    ),
  )
  expect(await loadJamoSvgGlyphs(['가', '나'])).toBeUndefined()
})

test('leaves syllables without approved data out of the result', async () => {
  vi.stubGlobal('fetch', vi.fn(() => respond(shard({ 가: glyph }))))
  const loaded = await loadJamoSvgGlyphs(['가', '거'])
  expect([...(loaded?.glyphs.keys() ?? [])]).toEqual(['가'])
})

test('returns undefined without fetching for non-syllables', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  expect(await loadJamoSvgGlyphs(['가', ' '])).toBeUndefined()
  expect(fetchMock).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/infrastructure/jamo-svg/jamo-svg-dataset.test.ts`
Expected: FAIL — cannot resolve `./jamo-svg-dataset`.

- [ ] **Step 3: Implement** — create `src/infrastructure/jamo-svg/jamo-svg-dataset.ts`:

```ts
import {
  getChoseongShardIndex,
  shardFileName,
} from '../../domain/korean/hangul'
import type {
  RuntimeJamoSvgGlyph,
  RuntimeJamoSvgShard,
} from '../../domain/korean/jamo-svg-runtime'

export type LoadedJamoSvgGlyphs = {
  unitsPerEm: number
  glyphs: Map<string, RuntimeJamoSvgGlyph>
}

// Static, read-only content; not learner state (DEC-039).
const shardCache = new Map<number, Promise<RuntimeJamoSvgShard>>()

function warn(message: string) {
  if (import.meta.env.DEV) console.warn(`[jamo-svg] ${message}`)
}

async function fetchShard(index: number): Promise<RuntimeJamoSvgShard> {
  const file = shardFileName(index)
  const response = await fetch(
    `${import.meta.env.BASE_URL}jamo-svg/pretendard-600/${file}`,
  )
  if (!response.ok)
    throw new Error(`shard ${file} returned HTTP ${response.status}`)
  const shard = (await response.json()) as RuntimeJamoSvgShard
  if (shard.datasetSchemaVersion !== 1)
    throw new Error(`shard ${file} has an unsupported schema version`)
  return shard
}

function loadShard(index: number) {
  let pending = shardCache.get(index)
  if (!pending) {
    const request = fetchShard(index)
    pending = request
    shardCache.set(index, request)
    request.catch(() => {
      if (shardCache.get(index) === request) shardCache.delete(index)
    })
  }
  return pending
}

/** Loads the shards the syllables need; undefined when any shard fails. */
export async function loadJamoSvgGlyphs(
  syllables: string[],
): Promise<LoadedJamoSvgGlyphs | undefined> {
  const indexes = syllables.map(getChoseongShardIndex)
  if (!indexes.length || indexes.some((index) => index === undefined))
    return undefined
  const unique = [...new Set(indexes as number[])]
  let shards: RuntimeJamoSvgShard[]
  try {
    shards = await Promise.all(unique.map(loadShard))
  } catch (error) {
    warn(error instanceof Error ? error.message : String(error))
    return undefined
  }
  const [first] = shards
  if (
    shards.some(
      (shard) =>
        shard.fontSha256 !== first.fontSha256 ||
        shard.unitsPerEm !== first.unitsPerEm,
    )
  ) {
    warn('shards disagree on font or units per em')
    return undefined
  }
  const glyphs = new Map<string, RuntimeJamoSvgGlyph>()
  syllables.forEach((syllable, position) => {
    const shard = shards[unique.indexOf(indexes[position] as number)]
    if (Object.hasOwn(shard.glyphs, syllable))
      glyphs.set(syllable, shard.glyphs[syllable])
  })
  return { unitsPerEm: first.unitsPerEm, glyphs }
}

export function resetJamoSvgDatasetCacheForTests() {
  shardCache.clear()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/infrastructure/jamo-svg/jamo-svg-dataset.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Suggest commit message**

`feat(jamo-svg): load runtime shards on demand with in-memory caching`

---

### Task 5: Feature flag

**Files:**
- Create: `src/features/typing/jamo-svg-flag.ts`
- Modify: `src/vite-env.d.ts` (add env key), `.env.example` (append)
- Test: `src/features/typing/jamo-svg-flag.test.ts`

**Interfaces:**
- Produces: `isJamoSvgRendererEnabled(): boolean`, `JAMO_SVG_RENDERER_STORAGE_KEY = 'jamozy:jamo-svg-renderer'`.

- [ ] **Step 1: Write the failing test** — create `src/features/typing/jamo-svg-flag.test.ts`:

```ts
import { afterEach, expect, test, vi } from 'vitest'
import {
  isJamoSvgRendererEnabled,
  JAMO_SVG_RENDERER_STORAGE_KEY,
} from './jamo-svg-flag'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  localStorage.clear()
})

test('production uses only the build flag', () => {
  vi.stubEnv('DEV', false)
  vi.stubEnv('VITE_JAMO_SVG_RENDERER', '1')
  localStorage.setItem(JAMO_SVG_RENDERER_STORAGE_KEY, '0')
  expect(isJamoSvgRendererEnabled()).toBe(true)
  vi.stubEnv('VITE_JAMO_SVG_RENDERER', '')
  localStorage.setItem(JAMO_SVG_RENDERER_STORAGE_KEY, '1')
  expect(isJamoSvgRendererEnabled()).toBe(false)
})

test('development lets localStorage override the build flag', () => {
  vi.stubEnv('DEV', true)
  vi.stubEnv('VITE_JAMO_SVG_RENDERER', '')
  expect(isJamoSvgRendererEnabled()).toBe(false)
  localStorage.setItem(JAMO_SVG_RENDERER_STORAGE_KEY, '1')
  expect(isJamoSvgRendererEnabled()).toBe(true)
  vi.stubEnv('VITE_JAMO_SVG_RENDERER', '1')
  localStorage.setItem(JAMO_SVG_RENDERER_STORAGE_KEY, '0')
  expect(isJamoSvgRendererEnabled()).toBe(false)
})

test('unavailable storage means no override', () => {
  vi.stubEnv('DEV', true)
  vi.stubEnv('VITE_JAMO_SVG_RENDERER', '1')
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  expect(isJamoSvgRendererEnabled()).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/typing/jamo-svg-flag.test.ts`
Expected: FAIL — cannot resolve `./jamo-svg-flag`.

- [ ] **Step 3: Implement** — create `src/features/typing/jamo-svg-flag.ts`:

```ts
export const JAMO_SVG_RENDERER_STORAGE_KEY = 'jamozy:jamo-svg-renderer'

/** SVG target renderer flag (DEC-039): build env, with a DEV-only local override. */
export function isJamoSvgRendererEnabled(): boolean {
  const fromBuild = import.meta.env.VITE_JAMO_SVG_RENDERER === '1'
  if (!import.meta.env.DEV) return fromBuild
  try {
    const override = window.localStorage.getItem(JAMO_SVG_RENDERER_STORAGE_KEY)
    if (override === '1') return true
    if (override === '0') return false
  } catch {
    // Storage unavailable: no override.
  }
  return fromBuild
}
```

In `src/vite-env.d.ts`, add inside `ImportMetaEnv`:

```ts
  readonly VITE_JAMO_SVG_RENDERER?: string
```

Append to `.env.example`:

```text
# Jamo SVG target renderer: 1 = on. In dev, localStorage "jamozy:jamo-svg-renderer" = "1"/"0" overrides.
VITE_JAMO_SVG_RENDERER=
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/typing/jamo-svg-flag.test.ts`
Expected: PASS.

- [ ] **Step 5: Suggest commit message**

`feat(jamo-svg): add Jamo SVG renderer feature flag`

---

### Task 6: Renderer selection, SVG renderer, and HangulTarget wrapper

**Files:**
- Create: `src/features/typing/hangul-target-selection.ts`
- Create: `src/features/typing/JamoSvgHangulTarget.tsx`
- Create: `src/features/typing/HangulTarget.tsx`
- Test: `src/features/typing/HangulTarget.test.tsx`

**Interfaces:**
- Consumes: `loadJamoSvgGlyphs`, `LoadedJamoSvgGlyphs` (Task 4); `isJamoSvgRendererEnabled` (Task 5); `getChoseongShardIndex` (Task 1); `buildExpectedKeys`, `ExpectedKey` (`src/domain/korean/target-sequence`); `TypingSessionState` (`src/domain/korean/typing-session`); `DecomposedHangulTarget` (existing default export).
- Produces:
  - `type SyllableGroup = { syllable: string; jamo: string[] }`
  - `svgTargetSyllables(targetText: string, expectedKeys: ExpectedKey[]): SyllableGroup[] | undefined`
  - `type RendererChoice = { kind: 'svg'; unitsPerEm: number; glyphs: Map<string, RuntimeJamoSvgGlyph> } | { kind: 'canvas'; reason: string }`
  - `chooseRenderer(groups: SyllableGroup[], loaded: LoadedJamoSvgGlyphs | undefined): RendererChoice`
  - `JAMO_SVG_LOAD_TIMEOUT_MS = 1500`
  - default export `HangulTarget({ session, className? })`

- [ ] **Step 1: Write the failing test** — create `src/features/typing/HangulTarget.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  pressKey,
  startTypingSession,
} from '../../domain/korean/typing-session'
import { loadJamoSvgGlyphs } from '../../infrastructure/jamo-svg/jamo-svg-dataset'
import HangulTarget, { JAMO_SVG_LOAD_TIMEOUT_MS } from './HangulTarget'
import { isJamoSvgRendererEnabled } from './jamo-svg-flag'

vi.mock('./jamo-svg-flag', () => ({ isJamoSvgRendererEnabled: vi.fn() }))
vi.mock('../../infrastructure/jamo-svg/jamo-svg-dataset', () => ({
  loadJamoSvgGlyphs: vi.fn(),
}))
vi.mock('./DecomposedHangulTarget', () => ({
  default: () => <div data-testid="canvas-target" />,
}))

const glyph = (...jamo: string[]) => ({
  width: 1770,
  paths: jamo.map((value, index) => ({ jamo: value, d: `M${index} 0` })),
})
const loaded = (entries: Record<string, ReturnType<typeof glyph>>) => ({
  unitsPerEm: 2048,
  glyphs: new Map(Object.entries(entries)),
})
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => (resolve = done))
  return { promise, resolve }
}
const fills = (container: HTMLElement) =>
  [...container.querySelectorAll('path')].map((path) => path.getAttribute('fill'))

beforeEach(() => {
  vi.mocked(isJamoSvgRendererEnabled).mockReturnValue(true)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

test('flag off renders Canvas without loading data', () => {
  vi.mocked(isJamoSvgRendererEnabled).mockReturnValue(false)
  render(<HangulTarget session={startTypingSession('가')} />)
  expect(screen.getByTestId('canvas-target')).toBeInTheDocument()
  expect(loadJamoSvgGlyphs).not.toHaveBeenCalled()
})

test('shows blank tiles, then SVG whose step fills follow keyIndex', async () => {
  const request = deferred<ReturnType<typeof loaded>>()
  vi.mocked(loadJamoSvgGlyphs).mockReturnValue(request.promise)
  const session = startTypingSession('가나')
  const { container, rerender } = render(<HangulTarget session={session} />)
  expect(screen.getAllByTestId('pending-hangul-tile')).toHaveLength(2)
  await act(async () =>
    request.resolve(loaded({ 가: glyph('ㄱ', 'ㅏ'), 나: glyph('ㄴ', 'ㅏ') })),
  )
  expect(container.querySelectorAll('svg')).toHaveLength(2)
  expect(fills(container)).toEqual(['#e990b6', '#c7c3bc', '#c7c3bc', '#c7c3bc'])
  rerender(<HangulTarget session={pressKey(session, 'KeyR', false)} />)
  expect(fills(container)).toEqual(['#20b981', '#e990b6', '#c7c3bc', '#c7c3bc'])
  expect(loadJamoSvgGlyphs).toHaveBeenCalledTimes(1)
})

test('a completed session shows every step as correct', async () => {
  vi.mocked(loadJamoSvgGlyphs).mockResolvedValue(loaded({ 가: glyph('ㄱ', 'ㅏ') }))
  let session = startTypingSession('가')
  session = pressKey(pressKey(session, 'KeyR', false), 'KeyK', false)
  const { container } = render(<HangulTarget session={session} />)
  await act(async () => {})
  expect(fills(container)).toEqual(['#20b981', '#20b981'])
})

test('one missing syllable renders Canvas for the whole target', async () => {
  vi.mocked(loadJamoSvgGlyphs).mockResolvedValue(loaded({ 가: glyph('ㄱ', 'ㅏ') }))
  render(<HangulTarget session={startTypingSession('가나')} />)
  expect(await screen.findByTestId('canvas-target')).toBeInTheDocument()
})

test('a standalone jamo renders Canvas without loading data', () => {
  render(<HangulTarget session={startTypingSession('ㄱ')} />)
  expect(screen.getByTestId('canvas-target')).toBeInTheDocument()
  expect(loadJamoSvgGlyphs).not.toHaveBeenCalled()
})

test('a target with a space renders Canvas (literal key)', () => {
  render(<HangulTarget session={startTypingSession('가 나')} />)
  expect(screen.getByTestId('canvas-target')).toBeInTheDocument()
  expect(loadJamoSvgGlyphs).not.toHaveBeenCalled()
})

test('a step mismatch renders Canvas', async () => {
  vi.mocked(loadJamoSvgGlyphs).mockResolvedValue(loaded({ 가: glyph('ㄱ', 'ㅓ') }))
  render(<HangulTarget session={startTypingSession('가')} />)
  expect(await screen.findByTestId('canvas-target')).toBeInTheDocument()
})

test('a timeout renders Canvas and keeps it when data arrives later', async () => {
  vi.useFakeTimers()
  const request = deferred<ReturnType<typeof loaded>>()
  vi.mocked(loadJamoSvgGlyphs).mockReturnValue(request.promise)
  const { container } = render(<HangulTarget session={startTypingSession('가')} />)
  act(() => vi.advanceTimersByTime(JAMO_SVG_LOAD_TIMEOUT_MS))
  expect(screen.getByTestId('canvas-target')).toBeInTheDocument()
  await act(async () => request.resolve(loaded({ 가: glyph('ㄱ', 'ㅏ') })))
  expect(screen.getByTestId('canvas-target')).toBeInTheDocument()
  expect(container.querySelector('svg')).toBeNull()
})

test('a target change discards the stale result', async () => {
  const first = deferred<ReturnType<typeof loaded>>()
  const second = deferred<ReturnType<typeof loaded>>()
  vi.mocked(loadJamoSvgGlyphs)
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise)
  const { container, rerender } = render(
    <HangulTarget session={startTypingSession('가')} />,
  )
  rerender(<HangulTarget session={startTypingSession('나')} />)
  await act(async () => second.resolve(loaded({ 나: glyph('ㄴ', 'ㅏ') })))
  await act(async () => first.resolve(loaded({ 가: glyph('ㄱ', 'ㅏ') })))
  const svgs = container.querySelectorAll('svg')
  expect(svgs).toHaveLength(1)
  expect(svgs[0].getAttribute('data-syllable')).toBe('나')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/typing/HangulTarget.test.tsx`
Expected: FAIL — cannot resolve `./HangulTarget`.

- [ ] **Step 3: Implement**

Create `src/features/typing/hangul-target-selection.ts`:

```ts
import { getChoseongShardIndex } from '../../domain/korean/hangul'
import type { RuntimeJamoSvgGlyph } from '../../domain/korean/jamo-svg-runtime'
import type { ExpectedKey } from '../../domain/korean/target-sequence'
import type { LoadedJamoSvgGlyphs } from '../../infrastructure/jamo-svg/jamo-svg-dataset'

export type SyllableGroup = { syllable: string; jamo: string[] }

export type RendererChoice =
  | {
      kind: 'svg'
      unitsPerEm: number
      glyphs: Map<string, RuntimeJamoSvgGlyph>
    }
  | { kind: 'canvas'; reason: string }

/** Target syllables with their typed jamo; undefined when any group is not a precomposed syllable. */
export function svgTargetSyllables(
  targetText: string,
  expectedKeys: ExpectedKey[],
): SyllableGroup[] | undefined {
  const characters = Array.from(targetText)
  const groups = new Map<number, string[]>()
  for (const key of expectedKeys) {
    const jamo = groups.get(key.syllableIndex) ?? []
    jamo.push(key.jamo)
    groups.set(key.syllableIndex, jamo)
  }
  const result: SyllableGroup[] = []
  for (const [syllableIndex, jamo] of groups) {
    const syllable = characters[syllableIndex] ?? ''
    if (getChoseongShardIndex(syllable) === undefined) return undefined
    result.push({ syllable, jamo })
  }
  return result.length ? result : undefined
}

/** SVG only when every syllable has a glyph whose paths match its typed keys (DEC-039). */
export function chooseRenderer(
  groups: SyllableGroup[],
  loaded: LoadedJamoSvgGlyphs | undefined,
): RendererChoice {
  if (!loaded) return { kind: 'canvas', reason: 'a runtime shard failed to load' }
  const missing = [
    ...new Set(
      groups
        .filter(({ syllable }) => !loaded.glyphs.has(syllable))
        .map(({ syllable }) => syllable),
    ),
  ]
  if (missing.length)
    return { kind: 'canvas', reason: `no approved SVG for ${missing.join(' ')}` }
  const mismatched = groups.filter(({ syllable, jamo }) => {
    const paths = loaded.glyphs.get(syllable)?.paths ?? []
    return (
      paths.length !== jamo.length ||
      paths.some((path, index) => path.jamo !== jamo[index])
    )
  })
  if (mismatched.length)
    return {
      kind: 'canvas',
      reason: `step mismatch for ${mismatched.map(({ syllable }) => syllable).join(' ')}`,
    }
  return { kind: 'svg', unitsPerEm: loaded.unitsPerEm, glyphs: loaded.glyphs }
}
```

Create `src/features/typing/JamoSvgHangulTarget.tsx` (visual component; no dedicated tests beyond Task 6's behavior tests):

```tsx
import type { RuntimeJamoSvgGlyph } from '../../domain/korean/jamo-svg-runtime'
import type { TypingSessionState } from '../../domain/korean/typing-session'

const COLORS = {
  correct: '#20b981',
  current: '#e990b6',
  pending: '#c7c3bc',
}
const TILE_CLASS =
  'h-26 w-26 rounded-md border border-[#bfd7fb] bg-[#fafcff]'

function fillFor(index: number, keyIndex: number) {
  if (index < keyIndex) return COLORS.correct
  if (index === keyIndex) return COLORS.current
  return COLORS.pending
}

interface JamoSvgHangulTargetProps {
  session: TypingSessionState
  glyphs: Map<string, RuntimeJamoSvgGlyph>
  unitsPerEm: number
  className?: string
}

/** Renders each syllable as Pretendard SVG paths, one per typed key. */
export default function JamoSvgHangulTarget({
  session,
  glyphs,
  unitsPerEm,
  className = '',
}: JamoSvgHangulTargetProps) {
  const characters = Array.from(session.targetText)
  const keyIndexes = new Map<number, number[]>()
  session.expectedKeys.forEach((key, index) => {
    const list = keyIndexes.get(key.syllableIndex) ?? []
    list.push(index)
    keyIndexes.set(key.syllableIndex, list)
  })

  return (
    <div
      className={`flex flex-wrap justify-center gap-2 ${className}`}
      aria-label={session.targetText}
      role="img"
    >
      {[...keyIndexes.entries()].map(([syllableIndex, indexes]) => {
        const syllable = characters[syllableIndex] ?? ''
        const glyph = glyphs.get(syllable)
        if (!glyph) return null
        return (
          <svg
            key={syllableIndex}
            viewBox={`0 0 ${glyph.width} ${unitsPerEm}`}
            className={`${TILE_CLASS} p-1.5`}
            data-syllable={syllable}
            aria-hidden="true"
          >
            {glyph.paths.map((path, step) => (
              <path
                key={step}
                d={path.d}
                fill={fillFor(indexes[step], session.keyIndex)}
              />
            ))}
          </svg>
        )
      })}
    </div>
  )
}

export function PendingHangulTiles({
  count,
  label,
  className = '',
}: {
  count: number
  label: string
  className?: string
}) {
  return (
    <div
      className={`flex flex-wrap justify-center gap-2 ${className}`}
      aria-label={label}
      aria-busy="true"
      role="img"
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className={TILE_CLASS}
          data-testid="pending-hangul-tile"
        />
      ))}
    </div>
  )
}
```

Create `src/features/typing/HangulTarget.tsx`:

```tsx
/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useState } from 'react'
import { buildExpectedKeys } from '../../domain/korean/target-sequence'
import type { TypingSessionState } from '../../domain/korean/typing-session'
import { loadJamoSvgGlyphs } from '../../infrastructure/jamo-svg/jamo-svg-dataset'
import DecomposedHangulTarget from './DecomposedHangulTarget'
import JamoSvgHangulTarget, { PendingHangulTiles } from './JamoSvgHangulTarget'
import {
  chooseRenderer,
  svgTargetSyllables,
  type RendererChoice,
} from './hangul-target-selection'
import { isJamoSvgRendererEnabled } from './jamo-svg-flag'

export const JAMO_SVG_LOAD_TIMEOUT_MS = 1500

interface HangulTargetProps {
  session: TypingSessionState
  className?: string
}

function warn(reason: string) {
  if (import.meta.env.DEV)
    console.warn(`[jamo-svg] Using Canvas for this target: ${reason}.`)
}

/** Chooses the SVG or legacy Canvas renderer for the whole target (DEC-039). */
export default function HangulTarget({
  session,
  className = '',
}: HangulTargetProps) {
  const [enabled] = useState(isJamoSvgRendererEnabled)
  const { targetText } = session
  const groups = useMemo(
    () => svgTargetSyllables(targetText, buildExpectedKeys(targetText)),
    [targetText],
  )
  const [decision, setDecision] = useState<{
    targetText: string
    choice: RendererChoice
  }>()

  useEffect(() => {
    if (!enabled) return
    if (!groups) {
      warn('the target has characters other than Hangul syllables')
      return
    }
    let active = true
    const decide = (choice: RendererChoice) => {
      if (!active) return
      active = false
      clearTimeout(timer)
      if (choice.kind === 'canvas') warn(choice.reason)
      setDecision({ targetText, choice })
    }
    const timer = setTimeout(
      () =>
        decide({
          kind: 'canvas',
          reason: `shards did not load within ${JAMO_SVG_LOAD_TIMEOUT_MS} ms`,
        }),
      JAMO_SVG_LOAD_TIMEOUT_MS,
    )
    void loadJamoSvgGlyphs(groups.map(({ syllable }) => syllable)).then(
      (loaded) => decide(chooseRenderer(groups, loaded)),
    )
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [enabled, groups, targetText])

  if (!enabled || !groups)
    return <DecomposedHangulTarget session={session} className={className} />
  const choice =
    decision?.targetText === targetText ? decision.choice : undefined
  if (!choice)
    return (
      <PendingHangulTiles
        count={groups.length}
        label={targetText}
        className={className}
      />
    )
  if (choice.kind === 'canvas')
    return <DecomposedHangulTarget session={session} className={className} />
  return (
    <JamoSvgHangulTarget
      session={session}
      glyphs={choice.glyphs}
      unitsPerEm={choice.unitsPerEm}
      className={className}
    />
  )
}
```

- [ ] **Step 4: Run tests and static checks**

Run: `pnpm vitest run src/features/typing/HangulTarget.test.tsx && npx tsc -b && npx eslint src/features/typing src/infrastructure/jamo-svg`
Expected: 9 tests PASS; no type or lint errors. If `react-hooks` flags `setDecision` inside the effect, it is only called from async callbacks (`setTimeout`, promise), which the rule allows; do not restructure unless the rule actually reports.

- [ ] **Step 5: Suggest commit message**

`feat(jamo-svg): render typing targets with per-step SVG behind a flag`

---

### Task 7: Switch call sites to HangulTarget

**Files:**
- Modify: `src/features/lesson/LessonTypingSession.tsx:11,130`
- Modify: `src/features/review/ReviewTypingSession.tsx:7,104`
- Modify: `src/features/home/OnePageLearningPlayer.tsx:7,166`

**Interfaces:**
- Consumes: default export `HangulTarget` (Task 6) with props `{ session, className? }`.

- [ ] **Step 1: Replace imports and elements** in each file:

```tsx
// before
import DecomposedHangulTarget from '../typing/DecomposedHangulTarget'
// after
import HangulTarget from '../typing/HangulTarget'
```

and rename the JSX element `<DecomposedHangulTarget` to `<HangulTarget`, keeping every prop unchanged.

- [ ] **Step 2: Run the full suite and checks**

Run: `pnpm test --run && pnpm lint && pnpm build`
Expected: all tests PASS (flag is off in tests, so existing Lesson/Review tests still see Canvas); lint clean; build succeeds and `dist/jamo-svg/pretendard-600/` contains 19 JSON files.

- [ ] **Step 3: Manual check (user)**

Set `localStorage.setItem('jamozy:jamo-svg-renderer', '1')` in the dev app, reload, open a lesson whose target is approved syllables only, and type. Then set `'0'` and reload to compare with Canvas.

- [ ] **Step 4: Suggest commit message**

`feat(jamo-svg): route lesson, review, and home targets through HangulTarget`

---

### Task 8: Documentation

**Files:**
- Modify: `docs/DECISIONS.md` (append DEC-039 after DEC-038)
- Modify: `docs/research/JAMO_SVG_TAGGER_DESIGN.md` §9 ("Future production runtime data") and §10 (deferred partitioning bullet)
- Modify: `AGENTS.md` (Jamo SVG tooling block)
- Modify: `docs/PROGRESS.md`, `README.md`, `docs/COMPLETE-LOG.md`

- [ ] **Step 1: Append DEC-039** to `docs/DECISIONS.md`, matching the existing `## DEC-038 — …` heading style:

```markdown
## DEC-039 — Jamo SVG runtime: committed choseong shards behind a flag

Status: Accepted (2026-10-03). Spec: `docs/superpowers/specs/2026-10-03-jamo-svg-runtime-design.md`.

- `pnpm jamo-svg:compile-runtime` compiles approved reviews into 19 shards,
  `public/jamo-svg/pretendard-600/00.json`–`18.json`, indexed by choseong via
  `getChoseongShardIndex`. Glyphs keep the minimal `{ width, paths[{ jamo, d }] }`
  shape; shards add `datasetSchemaVersion`, `fontSha256`, and `unitsPerEm`.
- The shards are committed, so build and deploy never need the font or the
  review tooling. A test fails when they drift from the approved reviews.
- The app loads only the shards a target needs, caches them in memory, and
  shares concurrent requests. Shards are static content, not learner state,
  so the loader lives in `src/infrastructure/jamo-svg/` without a repository.
- `HangulTarget` renders SVG only when every syllable of the target has
  approved data with matching steps; otherwise the legacy Canvas renders the
  whole target. Pretendard SVG and Noto Canvas are never mixed in one target.
  Blank tiles show while shards load; Canvas after 1,500 ms.
- The renderer is off unless `VITE_JAMO_SVG_RENDERER=1`; development builds
  also accept a `localStorage` override.

Why: prove compiler → dataset → typing state → per-step coloring with real
data before more review work, without font mismatches that look like
renderer bugs, and keep the Canvas renderer available for comparison.
Per-syllable fallback or retiring Canvas is decided later, when coverage is
high enough.
```

- [ ] **Step 2: Update the design doc** — in `docs/research/JAMO_SVG_TAGGER_DESIGN.md`:
  - Replace "The runtime renderer remains unchanged until this derived dataset and its integration are separately designed and approved." with "The derived dataset and its integration are designed in DEC-039 and `docs/superpowers/specs/2026-10-03-jamo-svg-runtime-design.md`."
  - Replace the §10 bullet "Runtime dataset file partitioning and delivery strategy. …" with "Runtime dataset partitioning and delivery: decided in DEC-039 (19 choseong shards, committed, loaded on demand)."

- [ ] **Step 3: Update AGENTS.md** — add to the Jamo SVG tooling command block:

```bash
pnpm jamo-svg:compile-runtime         # approved reviews → public/jamo-svg runtime shards
```

and add a bullet: "After approving reviews, run `pnpm jamo-svg:compile-runtime` and commit the shards with the reviews; `VITE_JAMO_SVG_RENDERER=1` turns on the SVG target renderer (DEC-039)."

- [ ] **Step 4: Update status docs** — `docs/PROGRESS.md` Dev Tooling: Jamo SVG table: add a row "Runtime dataset + SVG target renderer (flagged)"; `README.md` Next/Post-MVP line: mention the flagged SVG renderer; append a `docs/COMPLETE-LOG.md` entry dated 2026-10-03 listing the compiler, shards, loader, flag, and `HangulTarget`.

- [ ] **Step 5: Run checks**

Run: `npx prettier --check AGENTS.md docs/DECISIONS.md docs/PROGRESS.md docs/COMPLETE-LOG.md README.md`
Expected: clean, or only files that were already not prettier-clean at HEAD (leave those as they were).

- [ ] **Step 6: Suggest commit message**

`docs(jamo-svg): record DEC-039 runtime dataset and renderer decisions`
