# Korean Typing Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core Korean typing engine — 2-beolsik key map, Hangul composition, target-sequence compilation, and a jamo-level matching state machine for one exercise — as a framework-free, fully unit-tested subsystem, wrapped in a thin Zustand store.

**Architecture:** Four pure TypeScript files in `src/domain/korean/` with a linear dependency chain (`keymap.ts` + `hangul.ts` → `target-sequence.ts` → `typing-session.ts`), plus a thin Zustand store in `src/features/typing/` that wraps `typing-session.ts`'s pure reducer. Because every exercise's target text is known in advance, the whole expected-keystroke sequence is precompiled once (`target-sequence.ts`) — the runtime matcher just walks it index by index, with no IME-style ambiguity/backtracking.

**Tech Stack:** TypeScript 5, Vitest, Zustand (already a dependency, first use in this codebase).

**Spec:** `docs/superpowers/specs/2026-09-23-korean-typing-engine-design.md`

## Global Constraints

- Nothing under `src/domain/korean/` imports React or Zustand — pure TypeScript only, matching the rest of `domain/`.
- `KeyboardEvent.code` (physical key, layout-independent) is the input to the engine, never `KeyboardEvent.key`.
- This round supports only `Space`, `Period`, `Comma` as non-Hangul input — no other punctuation (extensible later, just new `keymap.ts` entries).
- Jamo-level blocking: a wrong key press counts as a mistake but never mutates composed text or advances position.
- No UI component, no lesson-sequencing, no `complete-lesson` wiring, no Firestore — this plan produces only the engine + store, unconsumed by any page this round.
- Relative imports throughout (no path aliases configured in this repo).

## Review Focus

1. **Empty target text** — `startTypingSession('')` should not need special-casing by callers: a reasonable person calling `getProgress`/`getComposedText`/`getCharacterStates` on it expects `{typed: 0, total: 0}`, `''`, and `[]` respectively, with `status` already `'completed'` (there's nothing to type). Pinned in Task 4.
2. **A key pressed after the session is already `'completed'`** — `expectedKeys[keyIndex]` is `undefined` once `keyIndex === expectedKeys.length`; comparing against it naively without a bounds/status guard would throw or silently misbehave. A reasonable person expects an extra keystroke after finishing to simply do nothing. Pinned in Task 4.
3. **A partially-typed *compound* jongseong** (e.g. ㅄ needs 2 keys: ㅂ then ㅅ) — after only the first of its 2 keys, `getComposedText` must show the syllable *without* a final consonant yet (not a wrong/partial glyph), and `getCharacterStates` must mark that syllable `'current'`, not `'correct'`, until both keys land. Pinned in Task 4.
4. **Correct physical key, wrong Shift state** (e.g. the learner presses the ㅃ/`KeyQ` key but forgets Shift, or vice versa) — must count as a mistake, not accidentally match. Easy bug to introduce by comparing only `code` and forgetting `shiftKey`. Pinned in Task 4.
5. **A target character with no keymap entry** (anything that isn't a precomposed Hangul syllable and isn't space/period/comma — e.g. a stray Latin letter or digit in lesson content) — `buildExpectedKeys` must fail loudly with a clear error at exercise-setup time, not silently skip the character or produce a keystroke sequence that can never be completed. Pinned in Task 3.

---

### Task 1: `keymap.ts` — 2-beolsik physical-key map

**Files:**
- Create: `src/domain/korean/keymap.ts`
- Test: `src/domain/korean/keymap.test.ts`

**Interfaces:**
- Produces: `KEY_TO_JAMO: Record<string, { base: string; shift?: string }>`, `JAMO_TO_KEY: Record<string, { code: string; shift: boolean }>`. Consumed by Task 3 (`target-sequence.ts`).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { JAMO_TO_KEY, KEY_TO_JAMO } from './keymap'

describe('KEY_TO_JAMO', () => {
  it('maps a plain consonant key', () => {
    expect(KEY_TO_JAMO.KeyR).toEqual({ base: 'ㄱ', shift: 'ㄲ' })
  })

  it('maps a vowel key with no shift variant', () => {
    expect(KEY_TO_JAMO.KeyK).toEqual({ base: 'ㅏ' })
  })

  it('maps punctuation and space with no jamo role', () => {
    expect(KEY_TO_JAMO.Comma).toEqual({ base: ',' })
    expect(KEY_TO_JAMO.Period).toEqual({ base: '.' })
    expect(KEY_TO_JAMO.Space).toEqual({ base: ' ' })
  })
})

describe('JAMO_TO_KEY', () => {
  it('inverts a base jamo back to its key with shift: false', () => {
    expect(JAMO_TO_KEY['ㄱ']).toEqual({ code: 'KeyR', shift: false })
  })

  it('inverts a shift jamo back to its key with shift: true', () => {
    expect(JAMO_TO_KEY['ㄲ']).toEqual({ code: 'KeyR', shift: true })
  })

  it('inverts punctuation with shift: false', () => {
    expect(JAMO_TO_KEY[',']).toEqual({ code: 'Comma', shift: false })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/domain/korean/keymap.test.ts`
Expected: FAIL — `src/domain/korean/keymap.ts` does not exist yet.

- [ ] **Step 3: Implement `keymap.ts`**

```ts
export const KEY_TO_JAMO: Record<string, { base: string; shift?: string }> = {
  // Choseong (initial consonant) keys
  KeyQ: { base: 'ㅂ', shift: 'ㅃ' },
  KeyW: { base: 'ㅈ', shift: 'ㅉ' },
  KeyE: { base: 'ㄷ', shift: 'ㄸ' },
  KeyR: { base: 'ㄱ', shift: 'ㄲ' },
  KeyT: { base: 'ㅅ', shift: 'ㅆ' },
  KeyA: { base: 'ㅁ' },
  KeyS: { base: 'ㄴ' },
  KeyD: { base: 'ㅇ' },
  KeyF: { base: 'ㄹ' },
  KeyG: { base: 'ㅎ' },
  KeyZ: { base: 'ㅋ' },
  KeyX: { base: 'ㅌ' },
  KeyC: { base: 'ㅊ' },
  KeyV: { base: 'ㅍ' },
  // Jungseong (vowel) keys
  KeyY: { base: 'ㅛ' },
  KeyU: { base: 'ㅕ' },
  KeyI: { base: 'ㅑ' },
  KeyO: { base: 'ㅐ', shift: 'ㅒ' },
  KeyP: { base: 'ㅔ', shift: 'ㅖ' },
  KeyH: { base: 'ㅗ' },
  KeyJ: { base: 'ㅓ' },
  KeyK: { base: 'ㅏ' },
  KeyL: { base: 'ㅣ' },
  KeyB: { base: 'ㅠ' },
  KeyN: { base: 'ㅜ' },
  KeyM: { base: 'ㅡ' },
  // Punctuation / space (no jamo role)
  Comma: { base: ',' },
  Period: { base: '.' },
  Space: { base: ' ' },
}

export const JAMO_TO_KEY: Record<string, { code: string; shift: boolean }> = Object.entries(
  KEY_TO_JAMO,
).reduce<Record<string, { code: string; shift: boolean }>>((acc, [code, { base, shift }]) => {
  acc[base] = { code, shift: false }
  if (shift) acc[shift] = { code, shift: true }
  return acc
}, {})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/domain/korean/keymap.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/domain/korean/keymap.ts src/domain/korean/keymap.test.ts
git commit -m "feat(korean): add 2-beolsik physical-key map"
```

---

### Task 2: `hangul.ts` — Unicode Hangul composition

**Files:**
- Create: `src/domain/korean/hangul.ts`
- Test: `src/domain/korean/hangul.test.ts`

**Interfaces:**
- Produces: `CHOSEONG_LIST: readonly string[]` (19), `JUNGSEONG_LIST: readonly string[]` (21), `JONGSEONG_LIST: readonly string[]` (28, index 0 = `''`/no final), `decomposeSyllable(char: string): {choseong: string; jungseong: string; jongseong: string} | null`, `composeSyllable(choseong: string, jungseong: string, jongseong?: string): string`, `COMPOUND_JUNGSEONG_PARTS: Record<string, [string, string]>` (7 entries), `COMPOUND_JONGSEONG_PARTS: Record<string, [string, string]>` (11 entries). Consumed by Tasks 3 and 4.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  COMPOUND_JONGSEONG_PARTS,
  COMPOUND_JUNGSEONG_PARTS,
  composeSyllable,
  decomposeSyllable,
} from './hangul'

describe('decomposeSyllable / composeSyllable round trips', () => {
  it('round-trips a syllable with no final consonant', () => {
    const decomposed = decomposeSyllable('가')
    expect(decomposed).toEqual({ choseong: 'ㄱ', jungseong: 'ㅏ', jongseong: '' })
    expect(composeSyllable('ㄱ', 'ㅏ')).toBe('가')
  })

  it('round-trips a syllable with a simple final consonant', () => {
    const decomposed = decomposeSyllable('안')
    expect(decomposed).toEqual({ choseong: 'ㅇ', jungseong: 'ㅏ', jongseong: 'ㄴ' })
    expect(composeSyllable('ㅇ', 'ㅏ', 'ㄴ')).toBe('안')
  })

  it('round-trips a syllable with a compound final consonant', () => {
    const decomposed = decomposeSyllable('값')
    expect(decomposed).toEqual({ choseong: 'ㄱ', jungseong: 'ㅏ', jongseong: 'ㅄ' })
    expect(composeSyllable('ㄱ', 'ㅏ', 'ㅄ')).toBe('값')
  })

  it('round-trips a syllable with a compound jungseong', () => {
    const decomposed = decomposeSyllable('화')
    expect(decomposed).toEqual({ choseong: 'ㅎ', jungseong: 'ㅘ', jongseong: '' })
    expect(composeSyllable('ㅎ', 'ㅘ')).toBe('화')
  })

  it('returns null for a non-syllable character', () => {
    expect(decomposeSyllable(',')).toBeNull()
    expect(decomposeSyllable(' ')).toBeNull()
    expect(decomposeSyllable('a')).toBeNull()
  })

  it('throws composing from jamo that are not valid choseong/jungseong/jongseong', () => {
    expect(() => composeSyllable('x', 'ㅏ')).toThrow()
  })
})

describe('compound part tables', () => {
  it('lists the 7 compound jungseong and their 2 typed parts', () => {
    expect(Object.keys(COMPOUND_JUNGSEONG_PARTS)).toHaveLength(7)
    expect(COMPOUND_JUNGSEONG_PARTS['ㅘ']).toEqual(['ㅗ', 'ㅏ'])
    expect(COMPOUND_JUNGSEONG_PARTS['ㅢ']).toEqual(['ㅡ', 'ㅣ'])
  })

  it('lists the 11 compound jongseong and their 2 typed parts', () => {
    expect(Object.keys(COMPOUND_JONGSEONG_PARTS)).toHaveLength(11)
    expect(COMPOUND_JONGSEONG_PARTS['ㅄ']).toEqual(['ㅂ', 'ㅅ'])
    expect(COMPOUND_JONGSEONG_PARTS['ㄺ']).toEqual(['ㄹ', 'ㄱ'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/domain/korean/hangul.test.ts`
Expected: FAIL — `src/domain/korean/hangul.ts` does not exist yet.

- [ ] **Step 3: Implement `hangul.ts`**

```ts
export const CHOSEONG_LIST = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const

export const JUNGSEONG_LIST = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
] as const

export const JONGSEONG_LIST = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
  'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const

const HANGUL_BASE = 0xac00
const JUNGSEONG_COUNT = JUNGSEONG_LIST.length
const JONGSEONG_COUNT = JONGSEONG_LIST.length
const SYLLABLE_COUNT = CHOSEONG_LIST.length * JUNGSEONG_COUNT * JONGSEONG_COUNT

export function decomposeSyllable(
  char: string,
): { choseong: string; jungseong: string; jongseong: string } | null {
  const code = char.codePointAt(0)
  if (code === undefined) return null

  const offset = code - HANGUL_BASE
  if (offset < 0 || offset >= SYLLABLE_COUNT) return null

  const jongseongIndex = offset % JONGSEONG_COUNT
  const jungseongIndex = Math.floor(offset / JONGSEONG_COUNT) % JUNGSEONG_COUNT
  const choseongIndex = Math.floor(offset / JONGSEONG_COUNT / JUNGSEONG_COUNT)

  return {
    choseong: CHOSEONG_LIST[choseongIndex],
    jungseong: JUNGSEONG_LIST[jungseongIndex],
    jongseong: JONGSEONG_LIST[jongseongIndex],
  }
}

export function composeSyllable(choseong: string, jungseong: string, jongseong = ''): string {
  const choseongIndex = CHOSEONG_LIST.indexOf(choseong as (typeof CHOSEONG_LIST)[number])
  const jungseongIndex = JUNGSEONG_LIST.indexOf(jungseong as (typeof JUNGSEONG_LIST)[number])
  const jongseongIndex = JONGSEONG_LIST.indexOf(jongseong as (typeof JONGSEONG_LIST)[number])

  if (choseongIndex < 0 || jungseongIndex < 0 || jongseongIndex < 0) {
    throw new Error(
      `Cannot compose syllable from choseong="${choseong}" jungseong="${jungseong}" jongseong="${jongseong}"`,
    )
  }

  const offset = (choseongIndex * JUNGSEONG_COUNT + jungseongIndex) * JONGSEONG_COUNT + jongseongIndex
  return String.fromCodePoint(HANGUL_BASE + offset)
}

export const COMPOUND_JUNGSEONG_PARTS: Record<string, [string, string]> = {
  ㅘ: ['ㅗ', 'ㅏ'],
  ㅙ: ['ㅗ', 'ㅐ'],
  ㅚ: ['ㅗ', 'ㅣ'],
  ㅝ: ['ㅜ', 'ㅓ'],
  ㅞ: ['ㅜ', 'ㅔ'],
  ㅟ: ['ㅜ', 'ㅣ'],
  ㅢ: ['ㅡ', 'ㅣ'],
}

export const COMPOUND_JONGSEONG_PARTS: Record<string, [string, string]> = {
  ㄳ: ['ㄱ', 'ㅅ'],
  ㄵ: ['ㄴ', 'ㅈ'],
  ㄶ: ['ㄴ', 'ㅎ'],
  ㄺ: ['ㄹ', 'ㄱ'],
  ㄻ: ['ㄹ', 'ㅁ'],
  ㄼ: ['ㄹ', 'ㅂ'],
  ㄽ: ['ㄹ', 'ㅅ'],
  ㄾ: ['ㄹ', 'ㅌ'],
  ㄿ: ['ㄹ', 'ㅍ'],
  ㅀ: ['ㄹ', 'ㅎ'],
  ㅄ: ['ㅂ', 'ㅅ'],
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/domain/korean/hangul.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/domain/korean/hangul.ts src/domain/korean/hangul.test.ts
git commit -m "feat(korean): add Unicode Hangul syllable composition"
```

---

### Task 3: `target-sequence.ts` — target text → expected keystrokes

**Files:**
- Create: `src/domain/korean/target-sequence.ts`
- Test: `src/domain/korean/target-sequence.test.ts`

**Interfaces:**
- Consumes: `JAMO_TO_KEY` (Task 1), `decomposeSyllable`, `COMPOUND_JUNGSEONG_PARTS`, `COMPOUND_JONGSEONG_PARTS` (Task 2).
- Produces: `ExpectedKey` interface and `buildExpectedKeys(targetText: string): ExpectedKey[]`. Consumed by Task 4.

**Note beyond the spec's literal interface:** the spec's `ExpectedKey` has 4 fields (`code`, `shift`, `jamo`, `syllableIndex`). This task adds a 5th, `slot: 'choseong' | 'jungseong' | 'jongseong' | 'literal'`. Task 4's `getComposedText` needs to know which part of a syllable each typed key belongs to in order to recombine a partially-typed compound jungseong/jongseong back into its single glyph — without `slot`, that would require re-deriving the same information at read time via fragile guesswork. Tagging it once here, where the decomposition is already being computed, is simpler and removes an entire class of bugs.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { buildExpectedKeys } from './target-sequence'

describe('buildExpectedKeys', () => {
  it('builds a plain word with no compounds, grouping keys by syllable', () => {
    const keys = buildExpectedKeys('사랑')

    expect(keys.map((k) => k.jamo)).toEqual(['ㅅ', 'ㅏ', 'ㄹ', 'ㅏ', 'ㅇ'])
    expect(keys.map((k) => k.code)).toEqual(['KeyT', 'KeyK', 'KeyF', 'KeyK', 'KeyD'])
    expect(keys.map((k) => k.syllableIndex)).toEqual([0, 0, 1, 1, 1])
    expect(keys.map((k) => k.slot)).toEqual([
      'choseong', 'jungseong', 'choseong', 'jungseong', 'jongseong',
    ])
  })

  it('expands a compound jungseong into its 2 keystrokes', () => {
    const keys = buildExpectedKeys('화')

    expect(keys.map((k) => k.jamo)).toEqual(['ㅎ', 'ㅗ', 'ㅏ'])
    expect(keys.map((k) => k.code)).toEqual(['KeyG', 'KeyH', 'KeyK'])
    expect(keys.map((k) => k.slot)).toEqual(['choseong', 'jungseong', 'jungseong'])
    expect(keys.every((k) => k.syllableIndex === 0)).toBe(true)
  })

  it('expands a compound jongseong into its 2 keystrokes', () => {
    const keys = buildExpectedKeys('값')

    expect(keys.map((k) => k.jamo)).toEqual(['ㄱ', 'ㅏ', 'ㅂ', 'ㅅ'])
    expect(keys.map((k) => k.slot)).toEqual([
      'choseong', 'jungseong', 'jongseong', 'jongseong',
    ])
  })

  it('gives space/period/comma their own literal single-key entry', () => {
    const keys = buildExpectedKeys('안, 녕.')

    expect(keys.map((k) => k.jamo)).toEqual([
      'ㅇ', 'ㅏ', 'ㄴ', ',', ' ', 'ㄴ', 'ㅕ', 'ㅇ', '.',
    ])
    expect(keys.map((k) => k.code)).toEqual([
      'KeyD', 'KeyK', 'KeyS', 'Comma', 'Space', 'KeyS', 'KeyU', 'KeyD', 'Period',
    ])
    expect(keys.map((k) => k.syllableIndex)).toEqual([0, 0, 0, 1, 2, 3, 3, 3, 4])
    expect(keys.filter((k) => k.slot === 'literal')).toHaveLength(3)
  })

  it('throws for a character with no keymap entry', () => {
    expect(() => buildExpectedKeys('a')).toThrow('No keymap entry for character: "a"')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/domain/korean/target-sequence.test.ts`
Expected: FAIL — `src/domain/korean/target-sequence.ts` does not exist yet.

- [ ] **Step 3: Implement `target-sequence.ts`**

```ts
import { JAMO_TO_KEY } from './keymap'
import {
  COMPOUND_JONGSEONG_PARTS,
  COMPOUND_JUNGSEONG_PARTS,
  decomposeSyllable,
} from './hangul'

export type JamoSlot = 'choseong' | 'jungseong' | 'jongseong' | 'literal'

export interface ExpectedKey {
  code: string
  shift: boolean
  jamo: string
  syllableIndex: number
  slot: JamoSlot
}

function toExpectedKey(jamo: string, syllableIndex: number, slot: JamoSlot): ExpectedKey {
  const key = JAMO_TO_KEY[jamo]
  if (!key) {
    throw new Error(`No keymap entry for character: "${jamo}"`)
  }
  return { code: key.code, shift: key.shift, jamo, syllableIndex, slot }
}

function expandParts(jamo: string, compoundParts: Record<string, [string, string]>): string[] {
  const parts = compoundParts[jamo]
  return parts ? [...parts] : [jamo]
}

export function buildExpectedKeys(targetText: string): ExpectedKey[] {
  const keys: ExpectedKey[] = []

  Array.from(targetText).forEach((char, syllableIndex) => {
    const decomposed = decomposeSyllable(char)

    if (!decomposed) {
      keys.push(toExpectedKey(char, syllableIndex, 'literal'))
      return
    }

    const { choseong, jungseong, jongseong } = decomposed
    keys.push(toExpectedKey(choseong, syllableIndex, 'choseong'))

    for (const jamo of expandParts(jungseong, COMPOUND_JUNGSEONG_PARTS)) {
      keys.push(toExpectedKey(jamo, syllableIndex, 'jungseong'))
    }

    if (jongseong) {
      for (const jamo of expandParts(jongseong, COMPOUND_JONGSEONG_PARTS)) {
        keys.push(toExpectedKey(jamo, syllableIndex, 'jongseong'))
      }
    }
  })

  return keys
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/domain/korean/target-sequence.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/domain/korean/target-sequence.ts src/domain/korean/target-sequence.test.ts
git commit -m "feat(korean): compile target text into expected keystrokes"
```

---

### Task 4: `typing-session.ts` — jamo-level matching state machine

**Files:**
- Create: `src/domain/korean/typing-session.ts`
- Test: `src/domain/korean/typing-session.test.ts`

**Interfaces:**
- Consumes: `ExpectedKey`, `buildExpectedKeys` (Task 3); `composeSyllable` (Task 2); `COMPOUND_JUNGSEONG_PARTS`, `COMPOUND_JONGSEONG_PARTS` (Task 2, needed to recombine a fully-typed compound jungseong/jongseong back into its single glyph for `composeSyllable`).
- Produces: `TypingSessionState`, `CharacterState`, `startTypingSession(targetText): TypingSessionState`, `pressKey(state, code, shiftKey): TypingSessionState`, `getComposedText(state): string`, `getCharacterStates(state): CharacterState[]`, `getAccuracy(state): number`, `getProgress(state): {typed: number; total: number}`. Consumed by Task 5.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  getAccuracy,
  getCharacterStates,
  getComposedText,
  getProgress,
  pressKey,
  startTypingSession,
} from './typing-session'

describe('startTypingSession', () => {
  it('starts in-progress for a non-empty target', () => {
    const state = startTypingSession('가')
    expect(state.status).toBe('in-progress')
    expect(state.keyIndex).toBe(0)
    expect(state.mistakeCount).toBe(0)
  })

  it('starts already completed for an empty target', () => {
    const state = startTypingSession('')
    expect(state.status).toBe('completed')
    expect(getProgress(state)).toEqual({ typed: 0, total: 0 })
    expect(getComposedText(state)).toBe('')
    expect(getCharacterStates(state)).toEqual([])
  })
})

describe('pressKey', () => {
  it('advances on a correct key and completes when the target is fully typed', () => {
    let state = startTypingSession('가') // ㄱ (KeyR) + ㅏ (KeyK)
    state = pressKey(state, 'KeyR', false)
    expect(state.keyIndex).toBe(1)
    expect(state.status).toBe('in-progress')

    state = pressKey(state, 'KeyK', false)
    expect(state.keyIndex).toBe(2)
    expect(state.status).toBe('completed')
    expect(state.mistakeCount).toBe(0)
  })

  it('rejects a wrong key: counts a mistake, does not advance or mutate composed text', () => {
    let state = startTypingSession('가')
    state = pressKey(state, 'KeyT', false) // wrong — ㅅ, not ㄱ

    expect(state.keyIndex).toBe(0)
    expect(state.mistakeCount).toBe(1)
    expect(getComposedText(state)).toBe('')
  })

  it('treats the correct code with the wrong Shift state as a mistake', () => {
    let state = startTypingSession('빵') // choseong ㅃ = Shift+KeyQ
    state = pressKey(state, 'KeyQ', false) // right key, missing Shift

    expect(state.keyIndex).toBe(0)
    expect(state.mistakeCount).toBe(1)

    state = pressKey(state, 'KeyQ', true) // now correct
    expect(state.keyIndex).toBe(1)
  })

  it('ignores further key presses once the session is completed', () => {
    let state = startTypingSession('가')
    state = pressKey(state, 'KeyR', false)
    state = pressKey(state, 'KeyK', false)
    expect(state.status).toBe('completed')

    const completed = state
    state = pressKey(state, 'KeyR', false)
    expect(state).toEqual(completed)
  })
})

describe('getComposedText', () => {
  it('shows only the choseong while the jungseong has not been typed yet', () => {
    let state = startTypingSession('가')
    state = pressKey(state, 'KeyR', false)
    expect(getComposedText(state)).toBe('ㄱ')
  })

  it('composes without a final consonant while a compound jongseong is only half-typed', () => {
    let state = startTypingSession('값') // ㄱ, ㅏ, ㅂ+ㅅ (compound jongseong)
    state = pressKey(state, 'KeyR', false) // ㄱ
    state = pressKey(state, 'KeyK', false) // ㅏ
    state = pressKey(state, 'KeyQ', false) // ㅂ (1st half of ㅄ)

    expect(getComposedText(state)).toBe('가') // no final yet
    expect(getCharacterStates(state)).toEqual(['current'])

    state = pressKey(state, 'KeyT', false) // ㅅ (2nd half of ㅄ)
    expect(getComposedText(state)).toBe('값')
    expect(getCharacterStates(state)).toEqual(['correct'])
  })

  it('reconstructs a compound jungseong once both its keys are typed', () => {
    let state = startTypingSession('화') // ㅎ, ㅗ+ㅏ (compound jungseong)
    state = pressKey(state, 'KeyG', false) // ㅎ
    expect(getComposedText(state)).toBe('ㅎ')

    state = pressKey(state, 'KeyH', false) // ㅗ (1st half of ㅘ)
    expect(getComposedText(state)).toBe('ㅎ') // still no complete jungseong

    state = pressKey(state, 'KeyK', false) // ㅏ (2nd half of ㅘ)
    expect(getComposedText(state)).toBe('화')
  })

  it('passes punctuation and space through once typed', () => {
    let state = startTypingSession('가,')
    state = pressKey(state, 'KeyR', false)
    state = pressKey(state, 'KeyK', false)
    state = pressKey(state, 'Comma', false)
    expect(getComposedText(state)).toBe('가,')
  })
})

describe('getCharacterStates', () => {
  it('marks a completed syllable correct and the next one current immediately', () => {
    let state = startTypingSession('사랑')
    state = pressKey(state, 'KeyT', false) // ㅅ
    state = pressKey(state, 'KeyK', false) // ㅏ — 사 complete, 랑 becomes current

    expect(getCharacterStates(state)).toEqual(['correct', 'current'])
  })

  it('marks every syllable correct once the whole target is typed', () => {
    let state = startTypingSession('사랑')
    state = pressKey(state, 'KeyT', false)
    state = pressKey(state, 'KeyK', false)
    state = pressKey(state, 'KeyF', false)
    state = pressKey(state, 'KeyK', false)
    state = pressKey(state, 'KeyD', false)

    expect(getCharacterStates(state)).toEqual(['correct', 'correct'])
  })
})

describe('getAccuracy', () => {
  it('is 0 with no key presses yet', () => {
    expect(getAccuracy(startTypingSession('가'))).toBe(0)
  })

  it('reflects correct presses against total attempts', () => {
    let state = startTypingSession('가')
    state = pressKey(state, 'KeyT', false) // wrong
    state = pressKey(state, 'KeyR', false) // correct
    expect(getAccuracy(state)).toBe(0.5)
  })
})

describe('getProgress', () => {
  it('only counts a syllable as typed once all of its keys are entered', () => {
    let state = startTypingSession('사랑')
    expect(getProgress(state)).toEqual({ typed: 0, total: 2 })

    state = pressKey(state, 'KeyT', false)
    expect(getProgress(state)).toEqual({ typed: 0, total: 2 }) // 사 not complete yet

    state = pressKey(state, 'KeyK', false)
    expect(getProgress(state)).toEqual({ typed: 1, total: 2 }) // 사 complete
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/domain/korean/typing-session.test.ts`
Expected: FAIL — `src/domain/korean/typing-session.ts` does not exist yet.

- [ ] **Step 3: Implement `typing-session.ts`**

```ts
import { buildExpectedKeys, type ExpectedKey } from './target-sequence'
import { COMPOUND_JONGSEONG_PARTS, COMPOUND_JUNGSEONG_PARTS, composeSyllable } from './hangul'

export type CharacterState = 'correct' | 'current' | 'pending'

export interface TypingSessionState {
  targetText: string
  expectedKeys: ExpectedKey[]
  keyIndex: number
  mistakeCount: number
  status: 'in-progress' | 'completed'
}

export function startTypingSession(targetText: string): TypingSessionState {
  const expectedKeys = buildExpectedKeys(targetText)
  return {
    targetText,
    expectedKeys,
    keyIndex: 0,
    mistakeCount: 0,
    status: expectedKeys.length === 0 ? 'completed' : 'in-progress',
  }
}

export function pressKey(state: TypingSessionState, code: string, shiftKey: boolean): TypingSessionState {
  if (state.status === 'completed') {
    return state
  }

  const expected = state.expectedKeys[state.keyIndex]
  if (expected.code === code && expected.shift === shiftKey) {
    const keyIndex = state.keyIndex + 1
    return {
      ...state,
      keyIndex,
      status: keyIndex === state.expectedKeys.length ? 'completed' : 'in-progress',
    }
  }

  return { ...state, mistakeCount: state.mistakeCount + 1 }
}

function syllableIndexes(state: TypingSessionState): number[] {
  return [...new Set(state.expectedKeys.map((k) => k.syllableIndex))]
}

function recombine(group: ExpectedKey[]): string {
  if (group.length === 1) return group[0].jamo
  const table = group[0].slot === 'jungseong' ? COMPOUND_JUNGSEONG_PARTS : COMPOUND_JONGSEONG_PARTS
  const match = Object.entries(table).find(
    ([, parts]) => parts[0] === group[0].jamo && parts[1] === group[1].jamo,
  )
  if (!match) {
    throw new Error(`Cannot recombine jamo parts: ${group.map((k) => k.jamo).join(', ')}`)
  }
  return match[0]
}

function composeFullSyllable(fullGroup: ExpectedKey[]): string {
  const choseong = fullGroup.find((k) => k.slot === 'choseong')!.jamo
  const jungseong = recombine(fullGroup.filter((k) => k.slot === 'jungseong'))
  const jongseongGroup = fullGroup.filter((k) => k.slot === 'jongseong')
  return composeSyllable(choseong, jungseong, jongseongGroup.length ? recombine(jongseongGroup) : undefined)
}

function composePartialSyllable(typedGroup: ExpectedKey[], fullGroup: ExpectedKey[]): string {
  const choseong = typedGroup.find((k) => k.slot === 'choseong')
  if (!choseong) return ''

  const jungseongTotal = fullGroup.filter((k) => k.slot === 'jungseong').length
  const jungseongTyped = typedGroup.filter((k) => k.slot === 'jungseong')
  if (jungseongTyped.length < jungseongTotal) return choseong.jamo

  const jungseong = recombine(jungseongTyped)
  const jongseongTotal = fullGroup.filter((k) => k.slot === 'jongseong').length
  if (jongseongTotal === 0) return composeSyllable(choseong.jamo, jungseong)

  const jongseongTyped = typedGroup.filter((k) => k.slot === 'jongseong')
  if (jongseongTyped.length < jongseongTotal) return composeSyllable(choseong.jamo, jungseong)

  return composeSyllable(choseong.jamo, jungseong, recombine(jongseongTyped))
}

export function getComposedText(state: TypingSessionState): string {
  const typedKeys = state.expectedKeys.slice(0, state.keyIndex)
  let result = ''

  for (const syllableIndex of syllableIndexes(state)) {
    const fullGroup = state.expectedKeys.filter((k) => k.syllableIndex === syllableIndex)
    const typedGroup = typedKeys.filter((k) => k.syllableIndex === syllableIndex)

    if (typedGroup.length === 0) break

    if (fullGroup[0].slot === 'literal') {
      result += fullGroup[0].jamo
      continue
    }

    result +=
      typedGroup.length === fullGroup.length
        ? composeFullSyllable(fullGroup)
        : composePartialSyllable(typedGroup, fullGroup)
  }

  return result
}

export function getCharacterStates(state: TypingSessionState): CharacterState[] {
  const characters = Array.from(state.targetText)
  const currentSyllableIndex = state.expectedKeys[state.keyIndex]?.syllableIndex

  return characters.map((_, syllableIndex) => {
    const fullGroup = state.expectedKeys.filter((k) => k.syllableIndex === syllableIndex)
    const typedCount = state.expectedKeys
      .slice(0, state.keyIndex)
      .filter((k) => k.syllableIndex === syllableIndex).length

    if (fullGroup.length > 0 && typedCount === fullGroup.length) return 'correct'
    if (syllableIndex === currentSyllableIndex) return 'current'
    return 'pending'
  })
}

export function getAccuracy(state: TypingSessionState): number {
  const attempts = state.keyIndex + state.mistakeCount
  return attempts === 0 ? 0 : state.keyIndex / attempts
}

export function getProgress(state: TypingSessionState): { typed: number; total: number } {
  const indexes = syllableIndexes(state)
  const typed = indexes.filter((syllableIndex) => {
    const fullGroup = state.expectedKeys.filter((k) => k.syllableIndex === syllableIndex)
    const typedGroup = state.expectedKeys
      .slice(0, state.keyIndex)
      .filter((k) => k.syllableIndex === syllableIndex)
    return typedGroup.length === fullGroup.length
  }).length

  return { typed, total: indexes.length }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/domain/korean/typing-session.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/domain/korean/typing-session.ts src/domain/korean/typing-session.test.ts
git commit -m "feat(korean): add jamo-level typing-session state machine"
```

---

### Task 5: `session-store.ts` — Zustand wrapper

**Files:**
- Create: `src/features/typing/session-store.ts`
- Test: `src/features/typing/session-store.test.ts`

**Interfaces:**
- Consumes: `startTypingSession`, `pressKey`, `TypingSessionState` (Task 4).
- Produces: `useTypingSessionStore` (Zustand hook/store with `session`, `start(targetText)`, `pressKey(code, shiftKey)`). Nothing later in this plan depends on this — it's the integration point for a future UI.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { useTypingSessionStore } from './session-store'

describe('useTypingSessionStore', () => {
  it('starts a session and applies pressKey to it', () => {
    useTypingSessionStore.getState().start('가')
    expect(useTypingSessionStore.getState().session?.targetText).toBe('가')
    expect(useTypingSessionStore.getState().session?.keyIndex).toBe(0)

    useTypingSessionStore.getState().pressKey('KeyR', false)
    expect(useTypingSessionStore.getState().session?.keyIndex).toBe(1)
  })

  it('ignores pressKey when no session has been started', () => {
    useTypingSessionStore.setState({ session: null })
    useTypingSessionStore.getState().pressKey('KeyR', false)
    expect(useTypingSessionStore.getState().session).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/features/typing/session-store.test.ts`
Expected: FAIL — `src/features/typing/session-store.ts` does not exist yet.

- [ ] **Step 3: Implement `session-store.ts`**

```ts
import { create } from 'zustand'
import {
  pressKey as pressKeyReducer,
  startTypingSession,
  type TypingSessionState,
} from '../../domain/korean/typing-session'

interface TypingSessionStore {
  session: TypingSessionState | null
  start: (targetText: string) => void
  pressKey: (code: string, shiftKey: boolean) => void
}

export const useTypingSessionStore = create<TypingSessionStore>((set, get) => ({
  session: null,
  start: (targetText) => set({ session: startTypingSession(targetText) }),
  pressKey: (code, shiftKey) => {
    const { session } = get()
    if (!session) return
    set({ session: pressKeyReducer(session, code, shiftKey) })
  },
}))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/features/typing/session-store.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck, lint, and the full suite**

Run: `pnpm exec tsc -b && pnpm lint && pnpm exec vitest run`
Expected: no errors; every test in the project passes, including all of Tasks 1–5.

- [ ] **Step 6: Commit**

```bash
git add src/features/typing/session-store.ts src/features/typing/session-store.test.ts
git commit -m "feat(typing): add Zustand store wrapping the typing-session engine"
```
