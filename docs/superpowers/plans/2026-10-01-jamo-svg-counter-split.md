# Jamo SVG Counter-Aware Split Recipes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one split recipe partition an outer contour *together with* a counter (hole) it encloses, so a seam can follow the counter's curved edge. This fixes the 13 reviews where a rounded initial (ㅇ ㅎ ㄹ) touches a two-bar vowel (ㅕ ㅖ ㅛ ㅠ): `여 역 연 열 염 영 옆 예 옛 요 용 효 륭`.

**Architecture:** `SplitRecipe` gains an optional `counterContours` list and `source-range` tokens gain an optional `contourId`; both default to the recipe's own source contour, so every existing recipe keeps its meaning and `splitRecipeSchemaVersion` stays `2`. Validation accepts a counter only if `counterContours(source)` pairs it with the recipe's source contour, and requires every command of the source contour and every non-`M` command of each counter to be consumed exactly once. The compiler resolves ranges and anchors against the declared contours. The proposer re-targets counters with the same structural guards it already uses for source contours. The Tagger UI lets a reviewer attach a counter and pick the contour of each range and seam.

**Tech Stack:** TypeScript, Vitest, React 19 (dev-only Tagger page), tsx scripts. No new dependencies.

**Spec:** This plan is the spec. Background: conversation decision "option 2", `docs/research/JAMO_SVG_TAGGER_DESIGN.md` (split recipe rules), `docs/DECISIONS.md` DEC-036/DEC-037.

## Global Constraints

- Geometry comes only from cached font commands and declared anchors; no hand-drawn or synthesized curves.
- Existing recipes without `counterContours` must validate and compile exactly as before (all 400+ approved reviews; `tools/jamo-svg/approved-reviews.test.ts` must stay green without data changes).
- `splitRecipeSchemaVersion` stays `2`; new fields are optional.
- A counter's command `0` (`M`) is never consumed by a range; anchors may reference its end point.
- Do not modify review data files in code tasks. Data changes happen only through the Tagger or `pnpm jamo-svg:propose`, after a commit.
- UI-only work gets no automated tests (AGENTS.md); logic in `tools/jamo-svg/*.ts` does.
- Run `pnpm test` before claiming a logic task complete.

## Review Focus

1. A recipe declares a contour that `counterContours()` does not pair with its source outline (the outline itself, or a counter of another outline such as `영`'s `c3 ⊂ c2`) → `invalid-split-recipe`. Pinned in Task 1.
2. A range on a counter starts at command `0` (the `M`), which would start a new subpath mid-piece → `invalid-split-recipe`. Pinned in Task 1.
3. A counter consumed by a recipe is also assigned whole to a step → `duplicate-ownership`. Pinned in Task 1.
4. The crescent between the straight seam and the counter's curve belongs to ㅇ, not ㅕ, in compiled output. Pinned in Task 2 by a point-in-path test.
5. A proposal whose template counter maps to a target contour with a different command shape is rejected rather than producing shards. Pinned in Task 3.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `tools/jamo-svg/types.ts` | Recipe schema | Add `counterContours?`, `source-range.contourId?` |
| `tools/jamo-svg/compile.ts` | Recipe validation, review validation, recipe compilation | Counter-aware `recipeIsValid`, `replaced` set, `compileRecipePiece` |
| `tools/jamo-svg/split-workbench.ts` | Piece path compiler, coverage helper | Resolve ranges/anchors across declared contours |
| `tools/jamo-svg/counter-split.fixture.ts` | Shared test fixture | Create: verified `여` counter split |
| `tools/jamo-svg/propose.ts` | Template proposals | Re-target counters and token contour ids |
| `src/features/dev-jamo-svg-tagger/JamoSvgTaggerPage.tsx` | Split Workbench UI | Counter toggle, per-range contour, cross-contour seams, per-contour coverage |
| `docs/DECISIONS.md`, `docs/research/JAMO_SVG_TAGGER_DESIGN.md`, `docs/COMPLETE-LOG.md` | Docs | DEC-038, recipe rule, log |

Verified geometry of `여` (Pretendard 600, algorithm v3), used by the fixture:

- `c0` (22 commands): ㅇ+ㅕ outline. Commands `0–3` are ㅇ's top-right arc ending at `(934,504)`; `4–10` are the bars and stem ending at `(950,1248)`; `11–21` are ㅇ's bottom and left arc back to `(554,254)`.
- `c1` (17 commands): ㅇ's own counter.
- `c2` (8 commands): counter between ㅇ and ㅕ. `0: M 996 686`, `1–3`: ㅇ's right edge curving down to `(1002,1068)`, `4–7`: `L1356 1068`, `L1356 686`, `L996 686`.

---

### Task 1: Schema and counter-aware validation

**Files:**
- Create: `tools/jamo-svg/counter-split.fixture.ts`
- Modify: `tools/jamo-svg/types.ts` (`RecipeToken`, `SplitRecipe`)
- Modify: `tools/jamo-svg/compile.ts` (`recipeIsValid`, `validateReview`'s `replaced` set)
- Test: `tools/jamo-svg/compile.test.ts`

**Interfaces:**
- Produces: `RecipeToken` `source-range` with `contourId?: number`; `SplitRecipe.counterContours?: Array<{ contourId: number; contourHash: string }>`; `yeoCounterSplit(glyph: CachedGlyph, status?: GlyphReview['status']): GlyphReview`.

- [ ] **Step 1: Extend the schema** in `tools/jamo-svg/types.ts`:

```ts
export type RecipeToken =
  | { kind: 'source-range'; fromCommand: number; toCommand: number; contourId?: number }
  | { kind: 'move-to-anchor'; anchor: SourceAnchor }
  | { kind: 'line-to-anchor'; anchor: SourceAnchor; reason: 'interior-closure-seam' }
  | { kind: 'close-to-start'; reason: 'interior-closure-seam' }
export type SplitRecipe = {
  splitRecipeSchemaVersion: typeof SPLIT_RECIPE_SCHEMA_VERSION
  id: string
  sourceContourId: number
  sourceContourHash: string
  /** Counters inside the source contour that this recipe partitions with it. */
  counterContours?: Array<{ contourId: number; contourHash: string }>
  method: 'source-command-partition'
  pieces: SplitPiece[]
  rationale: string
  visualValidation: { sourceContourHash: string; reconstructionHash?: string }
}
```

- [ ] **Step 2: Create the fixture** `tools/jamo-svg/counter-split.fixture.ts`:

```ts
import type { CachedGlyph, GlyphReview } from './types'

/**
 * Verified 여 split: contour 0 is the ㅇ+ㅕ outline, contour 1 is ㅇ's own
 * counter, and contour 2 is the counter between ㅇ and ㅕ whose left edge is
 * ㅇ's curve. ㅇ follows that curve; ㅕ takes the counter's other three sides.
 */
export function yeoCounterSplit(
  glyph: CachedGlyph,
  status: GlyphReview['status'] = 'reviewing',
): GlyphReview {
  const outer = glyph.contours[0]
  const gap = glyph.contours[2]
  return {
    reviewSchemaVersion: 2,
    syllable: glyph.syllable,
    source: { extraction: glyph.extraction, sourceGlyphHash: glyph.sourceGlyphHash },
    status,
    blockers: [],
    steps: [
      { order: 0, jamo: 'ㅇ', geometry: [{ kind: 'split-piece', recipeId: 'yeo-gap', pieceId: 'ieung' }, { kind: 'contour', contourId: 1 }] },
      { order: 1, jamo: 'ㅕ', geometry: [{ kind: 'split-piece', recipeId: 'yeo-gap', pieceId: 'yeo' }] },
    ],
    splitRecipes: [
      {
        splitRecipeSchemaVersion: 2,
        id: 'yeo-gap',
        sourceContourId: 0,
        sourceContourHash: outer.commandHash,
        counterContours: [{ contourId: 2, contourHash: gap.commandHash }],
        method: 'source-command-partition',
        rationale: 'ㅇ/ㅕ seam follows the counter between them.',
        visualValidation: { sourceContourHash: outer.commandHash },
        pieces: [
          {
            id: 'ieung',
            tokens: [
              { kind: 'source-range', fromCommand: 0, toCommand: 3 },
              { kind: 'line-to-anchor', anchor: { contourId: 2, commandIndex: 0, point: 'end' }, reason: 'interior-closure-seam' },
              { kind: 'source-range', contourId: 2, fromCommand: 1, toCommand: 3 },
              { kind: 'line-to-anchor', anchor: { contourId: 0, commandIndex: 10, point: 'end' }, reason: 'interior-closure-seam' },
              { kind: 'source-range', fromCommand: 11, toCommand: 21 },
            ],
          },
          {
            id: 'yeo',
            tokens: [
              { kind: 'source-range', fromCommand: 4, toCommand: 10 },
              { kind: 'line-to-anchor', anchor: { contourId: 2, commandIndex: 3, point: 'end' }, reason: 'interior-closure-seam' },
              { kind: 'source-range', contourId: 2, fromCommand: 4, toCommand: 7 },
              { kind: 'close-to-start', reason: 'interior-closure-seam' },
            ],
          },
        ],
      },
    ],
  }
}
```

- [ ] **Step 3: Write the failing tests** — append to `tools/jamo-svg/compile.test.ts` (add `import { yeoCounterSplit } from './counter-split.fixture'`; `extractGlyph` is already imported):

```ts
describe('counter-aware split recipes', () => {
  const recipeOf = (review: GlyphReview) => review.splitRecipes[0]
  const withRecipe = (review: GlyphReview, edit: (recipe: GlyphReview['splitRecipes'][number]) => void) => {
    const next = structuredClone(review)
    edit(recipeOf(next))
    return next
  }

  test('accepts 여 partitioned with the counter between ㅇ and ㅕ', async () => {
    const glyph = await extractGlyph('여')
    expect(validateReview(glyph, yeoCounterSplit(glyph)).blockers).toEqual([])
  })

  test('rejects a counter whose hash is stale', async () => {
    const glyph = await extractGlyph('여')
    const review = withRecipe(yeoCounterSplit(glyph), (recipe) => { recipe.counterContours![0].contourHash = 'stale' })
    expect(validateReview(glyph, review).blockers).toContain('invalid-split-recipe')
  })

  test('rejects a declared contour that is not a counter of the source outline', async () => {
    // Only counters that counterContours() pairs with the source contour qualify;
    // the outline itself (or a counter of another outline, e.g. 영's c3 ⊂ c2) does not.
    const glyph = await extractGlyph('여')
    const review = withRecipe(yeoCounterSplit(glyph), (recipe) => {
      recipe.counterContours = [...recipe.counterContours!, { contourId: 0, contourHash: glyph.contours[0].commandHash }]
    })
    expect(validateReview(glyph, review).blockers).toContain('invalid-split-recipe')
    expect(counterContours(await extractGlyph('영'))).toContainEqual({ counterId: 3, outerId: 2 })
  })

  test('rejects a counter range that consumes the counter M command', async () => {
    const glyph = await extractGlyph('여')
    const review = withRecipe(yeoCounterSplit(glyph), (recipe) => {
      recipe.pieces[0].tokens[2] = { kind: 'source-range', contourId: 2, fromCommand: 0, toCommand: 3 }
    })
    expect(validateReview(glyph, review).blockers).toContain('invalid-split-recipe')
  })

  test('rejects a counter whose commands are not all consumed exactly once', async () => {
    const glyph = await extractGlyph('여')
    const review = withRecipe(yeoCounterSplit(glyph), (recipe) => {
      recipe.pieces[1].tokens[2] = { kind: 'source-range', contourId: 2, fromCommand: 4, toCommand: 6 }
    })
    expect(validateReview(glyph, review).blockers).toContain('invalid-split-recipe')
  })

  test('rejects a range on a contour the recipe did not declare', async () => {
    const glyph = await extractGlyph('여')
    const review = withRecipe(yeoCounterSplit(glyph), (recipe) => { recipe.counterContours = [] })
    expect(validateReview(glyph, review).blockers).toContain('invalid-split-recipe')
  })

  test('reports a consumed counter that is also assigned whole', async () => {
    const glyph = await extractGlyph('여')
    const review = yeoCounterSplit(glyph)
    review.steps[1].geometry.push({ kind: 'contour', contourId: 2 })
    expect(validateReview(glyph, review).blockers).toContain('duplicate-ownership')
  })
})
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run tools/jamo-svg/compile.test.ts`
Expected: the new "accepts 여…" test FAILS with `invalid-split-recipe` (anchors on contour 2 are rejected today), and the type-level fields compile.

- [ ] **Step 5: Implement** — replace `recipeIsValid` in `tools/jamo-svg/compile.ts` (add `CachedContour` to the type import from `./types`):

```ts
function recipeIsValid(source: CachedGlyph, recipe: SplitRecipe): boolean {
  const contour = source.contours.find(({ id }) => id === recipe.sourceContourId)
  if (!contour || recipe.splitRecipeSchemaVersion !== SPLIT_RECIPE_SCHEMA_VERSION || contour.commandHash !== recipe.sourceContourHash) return false
  // A recipe may also partition counters that this outline encloses, so a
  // seam can follow a counter's edge. Their M command carries no geometry.
  const enclosed = new Set(counterContours(source).filter(({ outerId }) => outerId === contour.id).map(({ counterId }) => counterId))
  const counters = new Map<number, CachedContour>()
  for (const declared of recipe.counterContours ?? []) {
    const counter = source.contours.find(({ id }) => id === declared.contourId)
    if (!counter || !enclosed.has(counter.id) || counter.commandHash !== declared.contourHash || counters.has(counter.id)) return false
    counters.set(counter.id, counter)
  }
  const contourOf = (id = contour.id) => (id === contour.id ? contour : counters.get(id))
  const ids = new Set<string>()
  const coverage = new Map<string, number>()
  const consume = (id: number, index: number) => coverage.set(`${id}:${index}`, (coverage.get(`${id}:${index}`) ?? 0) + 1)
  const anchorIsUsable = (target: CachedContour, index: number, point: 'start' | 'end' | 'control1' | 'control2') => {
    const command = target.commands[index]
    if (!command) return false
    if (point === 'control1') return command.x1 !== undefined && command.y1 !== undefined
    if (point === 'control2') return command.x2 !== undefined && command.y2 !== undefined
    return command.x !== undefined && command.y !== undefined
  }
  const valid = recipe.pieces.every((piece) => {
    if (ids.has(piece.id)) return false
    ids.add(piece.id)
    return piece.tokens.every((token) => {
      if (token.kind === 'source-range') {
        const target = contourOf(token.contourId)
        if (!target || (target !== contour && token.fromCommand < 1)) return false
        if (token.fromCommand < 0 || token.toCommand < token.fromCommand || token.toCommand >= target.commands.length) return false
        for (let index = token.fromCommand; index <= token.toCommand; index += 1) consume(target.id, index)
        return true
      }
      if (token.kind === 'move-to-anchor' || token.kind === 'line-to-anchor') {
        const target = contourOf(token.anchor.contourId)
        return Boolean(target && anchorIsUsable(target, token.anchor.commandIndex, token.anchor.point))
      }
      return true
    })
  })
  return (
    valid &&
    contour.commands.every((_, index) => coverage.get(`${contour.id}:${index}`) === 1) &&
    [...counters.values()].every((counter) => counter.commands.every((_, index) => index === 0 || coverage.get(`${counter.id}:${index}`) === 1))
  )
}
```

In `validateReview`, make consumed counters count as replaced so whole assignment is a duplicate and absence is not "unassigned":

```ts
  const replaced = new Set(
    review.splitRecipes.flatMap(({ sourceContourId, counterContours = [] }) => [
      sourceContourId,
      ...counterContours.map(({ contourId }) => contourId),
    ]),
  )
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tools/jamo-svg`
Expected: PASS, including `approved-reviews.test.ts` (no data changed).

- [ ] **Step 7: Commit**

```bash
git add tools/jamo-svg/types.ts tools/jamo-svg/compile.ts tools/jamo-svg/compile.test.ts tools/jamo-svg/counter-split.fixture.ts
git commit -m "feat(jamo-svg): validate split recipes that partition an enclosed counter"
```

---

### Task 2: Compile pieces across declared contours

**Files:**
- Modify: `tools/jamo-svg/split-workbench.ts` (`commandCoverage`, `compileSplitPiecePreview`)
- Modify: `tools/jamo-svg/compile.ts` (`compileRecipePiece`)
- Test: `tools/jamo-svg/split-workbench.test.ts`, `tools/jamo-svg/compile.test.ts`

**Interfaces:**
- Consumes: Task 1 schema and fixture.
- Produces: `compileSplitPiecePreview(contour: CachedContour, piece: SplitPiece, counters?: CachedContour[]): string`; `commandCoverage(contour: CachedContour, pieces: SplitPiece[], sourceContourId?: number): number[]` (counts only tokens whose `contourId ?? sourceContourId` equals `contour.id`).

- [ ] **Step 1: Write the failing tests**

Append to `tools/jamo-svg/split-workbench.test.ts`:

```ts
test('counts coverage only for ranges on the requested contour', () => {
  const pieces = [
    { id: 'a', tokens: [{ kind: 'source-range' as const, fromCommand: 0, toCommand: 3 }] },
    { id: 'b', tokens: [{ kind: 'source-range' as const, contourId: 7, fromCommand: 1, toCommand: 2 }] },
  ]
  expect(commandCoverage(contour, pieces)).toEqual([1, 1, 1, 1])
  expect(commandCoverage({ ...contour, id: 7 }, pieces, 0)).toEqual([0, 1, 1, 0])
})
```

Append inside `describe('counter-aware split recipes')` in `tools/jamo-svg/compile.test.ts`:

```ts
  // Even-odd containment over the compiled on-curve points of every subpath.
  const contains = (d: string, x: number, y: number) =>
    d.split('M').filter(Boolean).reduce((inside, subpath) => {
      // Q commands list the control point first; keep only on-curve endpoints.
      const onCurve = subpath.split(/(?=[LQZ])/).flatMap((part) => {
        const values = (part.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
        return values.length >= 2 ? [[values.at(-2)!, values.at(-1)!] as [number, number]] : []
      })
      let crossings = 0
      onCurve.forEach(([px, py], index) => {
        const [qx, qy] = onCurve[(index + onCurve.length - 1) % onCurve.length]
        if ((py > y) !== (qy > y) && x < ((qx - px) * (y - py)) / (qy - py) + px) crossings += 1
      })
      return crossings % 2 === 1 ? !inside : inside
    }, false)

  test('gives the crescent left of the counter curve to ㅇ, not ㅕ', async () => {
    const glyph = await extractGlyph('여')
    const [ieung, yeo] = compileReview(glyph, yeoCounterSplit(glyph)).paths
    // (975, 900) lies between the straight seam (x≈940) and the counter's curve (x≈1010).
    expect(contains(ieung.d, 975, 900)).toBe(true)
    expect(contains(yeo.d, 975, 900)).toBe(false)
    // The counter interior stays empty for both.
    expect(contains(ieung.d, 1200, 900)).toBe(false)
    expect(contains(yeo.d, 1200, 900)).toBe(false)
    expect(contains(yeo.d, 1466, 900)).toBe(true)
  })
```


- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tools/jamo-svg/split-workbench.test.ts tools/jamo-svg/compile.test.ts`
Expected: FAIL — coverage ignores `contourId`; compile throws `Selected anchor is outside this contour.`

- [ ] **Step 3: Implement** in `tools/jamo-svg/split-workbench.ts`:

```ts
/** Only source ranges consume source geometry; anchors and seams are synthetic path controls. */
export function commandCoverage(contour: CachedContour, pieces: SplitPiece[], sourceContourId = contour.id) {
  return contour.commands.map((_, index) =>
    pieces.reduce(
      (count, piece) =>
        count +
        piece.tokens.filter(
          (token) =>
            token.kind === 'source-range' &&
            (token.contourId ?? sourceContourId) === contour.id &&
            index >= token.fromCommand &&
            index <= token.toCommand,
        ).length,
      0,
    ),
  )
}
```

and change `compileSplitPiecePreview` to accept counters:

```ts
export function compileSplitPiecePreview(contour: CachedContour, piece: SplitPiece, counters: CachedContour[] = []) {
  const contourOf = (id = contour.id) => (id === contour.id ? contour : counters.find((counter) => counter.id === id))
  const commands: OutlineCommand[] = []
  for (const [tokenIndex, token] of piece.tokens.entries()) {
    if (token.kind === 'source-range') {
      const target = contourOf(token.contourId)
      if (!target) throw new Error('Source range is on a contour this recipe does not declare.')
      const firstCommand = target.commands[token.fromCommand]
      const previousToken = piece.tokens[tokenIndex - 1]
      const hasExplicitCursor = previousToken?.kind === 'move-to-anchor' || previousToken?.kind === 'line-to-anchor'
      if (firstCommand?.type !== 'M' && commands.at(-1)?.type !== 'M' && !hasExplicitCursor) {
        const cursor = cursorBeforeCommand(target, token.fromCommand)
        if (!cursor) throw new Error('Source range has no recoverable start point.')
        commands.push({ type: 'M', x: cursor.x, y: cursor.y })
      }
      commands.push(...target.commands.slice(token.fromCommand, token.toCommand + 1))
      continue
    }
    if (token.kind === 'close-to-start') {
      commands.push({ type: 'Z' })
      continue
    }
    const target = contourOf(token.anchor.contourId)
    if (!target) throw new Error("Selected anchor is outside this recipe's contours.")
    const { x, y } = anchorCommand(target, token.anchor.commandIndex, token.anchor.point)
    commands.push({ type: token.kind === 'move-to-anchor' || commands.length === 0 ? 'M' : 'L', x, y })
  }
  if (!commands.some((command) => command.type === 'M')) throw new Error('Add a source range beginning with M or a move-to-anchor.')
  return commands.map(commandToSvg).join(' ')
}
```

In `tools/jamo-svg/compile.ts`, pass declared counters:

```ts
export function compileRecipePiece(source: CachedGlyph, recipe: SplitRecipe, pieceId: string): string {
  const contour = source.contours.find(({ id }) => id === recipe.sourceContourId)
  const piece = recipe.pieces.find(({ id }) => id === pieceId)
  if (!contour || !piece) throw new Error('Unknown split recipe piece.')
  const counters = (recipe.counterContours ?? []).flatMap(({ contourId }) => source.contours.filter(({ id }) => id === contourId))
  return compileSplitPiecePreview(contour, piece, counters)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tools/jamo-svg`
Expected: PASS (all existing split, seed, and approved-review tests unchanged).

- [ ] **Step 5: Commit**

```bash
git add tools/jamo-svg/split-workbench.ts tools/jamo-svg/compile.ts tools/jamo-svg/split-workbench.test.ts tools/jamo-svg/compile.test.ts
git commit -m "feat(jamo-svg): compile split pieces across a recipe's declared counters"
```

---

### Task 3: Proposals transfer counter recipes

**Files:**
- Modify: `tools/jamo-svg/propose.ts` (`transferRecipes`)
- Test: `tools/jamo-svg/propose.test.ts`

**Interfaces:**
- Consumes: Task 1 schema, Task 1 fixture, existing `pointDistance`, `matchContours`.
- Produces: proposals whose recipes carry re-targeted `counterContours`, `source-range.contourId`, and anchor `contourId`.

- [ ] **Step 1: Write the failing tests** — append inside `describe('split recipe transfer')` in `tools/jamo-svg/propose.test.ts` (add `import { yeoCounterSplit } from './counter-split.fixture'`):

```ts
    const yeoTemplate = async (): Promise<ApprovedTemplate> => {
      const glyph = await extractGlyph('여')
      return { glyph, review: yeoCounterSplit(glyph, 'approved') }
    }
    const renamedYeo = async (edit?: (glyph: CachedGlyph) => void) => {
      const glyph = structuredClone(await extractGlyph('여'))
      glyph.syllable = '혀'
      edit?.(glyph)
      return glyph
    }

    test('re-targets a counter recipe onto the matched outline and counter', async () => {
      const proposal = proposeReview(await renamedYeo(), [await yeoTemplate()], 250)
      expect(proposal?.review.splitRecipes[0].counterContours).toEqual([{ contourId: 2, contourHash: (await extractGlyph('여')).contours[2].commandHash }])
      expect(proposal?.review.blockers).toEqual([])
    })

    test('rejects a counter recipe when the counter has a different command shape', async () => {
      const target = await renamedYeo((glyph) => { glyph.contours[2].commandTypes += 'L' })
      expect(proposeReview(target, [await yeoTemplate()], 250)).toBeUndefined()
    })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tools/jamo-svg/propose.test.ts`
Expected: FAIL — `counterContours` is copied unchanged and the shape-mismatch case still proposes (only the source contour is checked).

- [ ] **Step 3: Implement** — replace the body of the `for (const recipe of review.splitRecipes)` loop in `transferRecipes`:

```ts
  for (const recipe of review.splitRecipes) {
    const matched = (templateId: number) => {
      const from = template.contours.find(({ id }) => id === templateId)
      const index = from && targetIndexOf.get(template.contours.indexOf(from))
      const to = index === undefined ? undefined : target.contours[index]
      // Same command shape is not enough: a contour can start elsewhere or bend
      // differently, so every command must also land near its template point.
      return from && to && to.commandTypes === from.commandTypes && to.commands.length === from.commands.length && pointDistance(to, from) <= maxCost ? { from, to } : undefined
    }
    const source = matched(recipe.sourceContourId)
    const counters = (recipe.counterContours ?? []).map(({ contourId }) => matched(contourId))
    if (!source || counters.some((counter) => !counter)) return undefined
    const idOf = new Map([[source.from.id, source.to.id], ...counters.map((counter) => [counter!.from.id, counter!.to.id] as const)])
    const retarget = (id: number) => idOf.get(id) ?? source.to.id
    recipes.push({
      ...recipe,
      sourceContourId: source.to.id,
      sourceContourHash: source.to.commandHash,
      ...(recipe.counterContours ? { counterContours: counters.map((counter) => ({ contourId: counter!.to.id, contourHash: counter!.to.commandHash })) } : {}),
      visualValidation: { sourceContourHash: source.to.commandHash },
      rationale: `Proposed from ${template.syllable}: ${recipe.rationale}`,
      pieces: recipe.pieces.map((piece) => ({
        ...piece,
        tokens: piece.tokens.map((token): RecipeToken =>
          token.kind === 'move-to-anchor' || token.kind === 'line-to-anchor'
            ? { ...token, anchor: { ...token.anchor, contourId: retarget(token.anchor.contourId) } }
            : token.kind === 'source-range' && token.contourId !== undefined
              ? { ...token, contourId: retarget(token.contourId) }
              : token,
        ),
      })),
    })
  }
```

Remove the now-unused `anchor` helper and `SourceAnchor` import if lint flags them.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tools/jamo-svg`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/jamo-svg/propose.ts tools/jamo-svg/propose.test.ts
git commit -m "feat(jamo-svg): transfer counter-aware split recipes in proposals"
```

---

### Task 4: Split Workbench UI for counters (manual verification)

**Files:**
- Modify: `src/features/dev-jamo-svg-tagger/JamoSvgTaggerPage.tsx`

No automated tests (UI-only). Verify manually with `여`.

**Interfaces:**
- Consumes: `counterContours` from `tools/jamo-svg/compile` (pure; the page already imports from `tools/jamo-svg`), Task 1 schema, Task 2 `commandCoverage(contour, pieces, sourceContourId)`.

- [ ] **Step 1: Local types** — in the page's `Review` type, add to each `splitRecipes` item:

```ts
    counterContours?: Array<{ contourId: number; contourHash: string }>
```

- [ ] **Step 2: Counter list and toggle** — next to `activeRecipe`/`activeContour`:

```ts
  const enclosedCounters =
    state && activeContour
      ? counterContours(state.source as unknown as CachedGlyph)
          .filter(({ outerId }) => outerId === activeContour.id)
          .flatMap(({ counterId }) => state.source.contours.filter(({ id }) => id === counterId))
      : []
  const recipeContours = activeContour && activeRecipe
    ? [activeContour, ...enclosedCounters.filter(({ id }) => activeRecipe.counterContours?.some((item) => item.contourId === id))]
    : []
  const toggleCounter = (counterId: number) => {
    if (!state || !activeRecipe) return
    const counter = state.source.contours.find(({ id }) => id === counterId)
    if (!counter) return
    const declared = activeRecipe.counterContours?.some((item) => item.contourId === counterId)
    const review = beginReview({
      ...state.review,
      splitRecipes: state.review.splitRecipes.map((recipe) =>
        recipe.id !== activeRecipe.id
          ? recipe
          : {
              ...recipe,
              counterContours: declared
                ? recipe.counterContours?.filter((item) => item.contourId !== counterId)
                : [...(recipe.counterContours ?? []), { contourId: counterId, contourHash: counter.commandHash }],
              // Removing a counter also removes every range and seam on it.
              pieces: declared
                ? recipe.pieces.map((piece) => ({
                    ...piece,
                    tokens: piece.tokens.filter((token) =>
                      token.kind === 'source-range' ? token.contourId !== counterId : token.kind === 'close-to-start' || token.anchor.contourId !== counterId,
                    ),
                  }))
                : recipe.pieces,
            },
      ),
      // A consumed counter can no longer be owned whole.
      steps: declared
        ? state.review.steps
        : state.review.steps.map((step) => ({ ...step, geometry: step.geometry.filter((ref) => ref.kind !== 'contour' || ref.contourId !== counterId) })),
    })
    updateDraft(review)
  }
```

Render under "Pieces and coverage" when `enclosedCounters.length > 0`:

```tsx
<div className="mt-2 rounded border border-dashed border-[#d8e3f2] p-2 text-xs">
  <strong>Counters inside this contour</strong>
  {enclosedCounters.map((counter) => (
    <label key={counter.id} className="mt-1 block">
      <input type="checkbox" checked={Boolean(activeRecipe.counterContours?.some((item) => item.contourId === counter.id))} onChange={() => toggleCounter(counter.id)} />{' '}
      Split with Contour {counter.id + 1} ({counter.commands.length} commands; command 0 is its start and is never consumed)
    </label>
  ))}
</div>
```

- [ ] **Step 3: Per-contour coverage line** — replace the single coverage `<p>` with one line per `recipeContours` entry using `commandCoverage(contour, activeRecipe.pieces, activeRecipe.sourceContourId)`; for a counter, exclude index 0 from the counts (`.slice(1)`), and label it `Contour N (counter)`. Also count `toCommand >= commands.length` ranges as `out of range` for each contour.

- [ ] **Step 4: Range contour selector** — in each source-range row (around the `SourceRangeEditor` usage), when `recipeContours.length > 1`, render before the editor:

```tsx
<label className="text-xs font-semibold">
  Contour
  <select
    className="ml-2 rounded border p-1 font-normal"
    value={token.contourId ?? activeRecipe.sourceContourId}
    onChange={(event) => {
      const contourId = Number(event.target.value)
      updatePiece(activeRecipe.id, piece.id, piece.tokens.map((item, index) =>
        index === tokenIndex && item.kind === 'source-range'
          ? { ...item, contourId: contourId === activeRecipe.sourceContourId ? undefined : contourId, fromCommand: contourId === activeRecipe.sourceContourId ? item.fromCommand : Math.max(1, item.fromCommand) }
          : item,
      ))
    }}
  >
    {recipeContours.map((contour) => (
      <option key={contour.id} value={contour.id}>Contour {contour.id + 1}{contour.id === activeRecipe.sourceContourId ? '' : ' (counter)'}</option>
    ))}
  </select>
</label>
```

- [ ] **Step 5: Cross-contour seams** — in the "Line seam to next range" `<select>`, list options for every `recipeContours` entry as `value={`${contour.id}:${index}`}` with label `Contour N · command k end`, and default to the end of the command before the next range **on that range's contour** (`nextRange.contourId ?? activeRecipe.sourceContourId`, index `fromCommand - 1`). On change, parse `contourId` and `commandIndex` from the value and insert `{ kind: 'line-to-anchor', anchor: { contourId, commandIndex, point: 'end' }, reason: 'interior-closure-seam' }`. Show the existing seam label as `Seam before next range → Contour N · command k end`. Apply the same contour-aware default in `updateSourceRange`'s automatic seam (`activeContour.id` → the next range's contour).

- [ ] **Step 6: Painter shows counters** — pass `recipeContours` to both `CommandRangePainter`s and draw each declared counter's commands in the same SVG (non-active contour in light stroke, ranges with matching `contourId` highlighted). Keep the inspector zoom on the union of the declared contours' bounds.

- [ ] **Step 7: Static checks**

Run: `npx eslint src/features/dev-jamo-svg-tagger/JamoSvgTaggerPage.tsx && npx tsc -b && pnpm test`
Expected: no errors; all tests pass.

- [ ] **Step 8: Manual verification (user)** — restart `pnpm dev`, open `여`, delete its current recipe, recreate on Contour 1, tick "Split with Contour 3", and enter the fixture's tokens (Task 1 Step 2). Expect: coverage `22/22` and `7/7 (counter)`, no blockers, ㅇ step shows a full round right edge, ㅕ step shows only bars and stem.

- [ ] **Step 9: Commit**

```bash
git add src/features/dev-jamo-svg-tagger/JamoSvgTaggerPage.tsx
git commit -m "feat(jamo-svg-tagger): split a contour together with its enclosed counter"
```

---

### Task 5: Decision record and docs

**Files:**
- Modify: `docs/DECISIONS.md`, `docs/research/JAMO_SVG_TAGGER_DESIGN.md`, `docs/COMPLETE-LOG.md`

- [ ] **Step 1: Append DEC-038** to `docs/DECISIONS.md`:

```markdown
---

## DEC-038 — Split recipes may partition an enclosed counter with its outline

**Date:** 2026-10-01
**Status:** Accepted

**Decision:** A split recipe may declare `counterContours`: counters that
`counterContours(source)` pairs with the recipe's source contour. Its pieces
may then consume source ranges and use anchors on those counters. Every
source-contour command and every counter command except the counter's leading
`M` must be consumed exactly once; a consumed counter cannot also be owned
whole. Recipes without counters are unchanged.

**Why:** Where a rounded initial touches a two-bar vowel (`여 요 효 륭`), the
counter between them is bounded by the initial's curve. A seam restricted to
the outline's own points can only be straight, so part of the initial was
painted as the vowel.

**Consequences:** Geometry is still only replayed font commands plus declared
straight seams. Proposals transfer counter recipes under the same command-
shape and point-distance guards as other recipes.
```

- [ ] **Step 2: Design doc** — in `docs/research/JAMO_SVG_TAGGER_DESIGN.md`, after the `counter-owner-mismatch` paragraph, add:

```markdown
A recipe may also partition counters enclosed by its source contour
(`counterContours`, DEC-038). `source-range.contourId` and anchor `contourId`
select the contour; omitted, they mean the recipe's source contour. A
counter's leading `M` is never consumed.
```

- [ ] **Step 3: Log** — append to `docs/COMPLETE-LOG.md`:

```markdown
### 2026-10-01 — Jamo SVG counter-aware split recipes

- Split recipes can partition an enclosed counter together with its outline
  ([[DEC-038]]), so ㅇ/ㅎ/ㄹ seams follow the counter's curve next to
  ㅕ ㅖ ㅛ ㅠ. Validation, compilation, proposals, and the Split Workbench
  support it; existing recipes are unchanged.
```

- [ ] **Step 4: Commit**

```bash
git add docs/DECISIONS.md docs/research/JAMO_SVG_TAGGER_DESIGN.md docs/COMPLETE-LOG.md
git commit -m "docs(jamo-svg): record counter-aware split recipes (DEC-038)"
```

---

### After the plan (data, by the reviewer)

1. Commit, then re-split `여` in the Tagger (Task 4 Step 8) and approve it.
2. Re-split one representative per shape, e.g. `요` (counter under ㅇ), `예` (ㅖ), `효`, `륭`, then approve.
3. `pnpm jamo-svg:propose --max-cost 350 --dry-run`; if the list is plausible, run it without `--dry-run` and review the remaining proposals.
