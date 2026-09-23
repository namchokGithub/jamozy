# Korean Typing Engine — Design

**Date:** 2026-09-23
**Status:** Approved, not yet implemented

## Goal

Build the core Korean typing engine as an isolated, framework-free subsystem: a 2-beolsik physical-key map, Hangul decomposition/composition, and a jamo-level matching state machine for a single typing exercise, wrapped in a thin Zustand store. This is what a future "Start Lesson" UI will run — but that UI, lesson-exercise sequencing, aggregate lesson metrics, and `complete-lesson` wiring are explicitly **not** part of this round.

## Why our own composition engine, not the OS/browser Korean IME

The product's stated purpose (`README.md`) is teaching the Korean keyboard layout itself, and `docs/requirement.md` #10 wants the UI to highlight the next physical key to press (and Shift, when needed). That's only possible if the app interprets raw physical keystrokes itself — an OS/browser Korean IME would only ever expose already-composed Hangul text, with no way to know which physical key produced it. So this engine intercepts `KeyboardEvent.code` (physical key position, layout-independent) and does its own 2-beolsik → jamo → syllable composition.

## Scope

**In scope, this round:**

- 2-beolsik physical-key ↔ jamo/punctuation map (`Space`, `Period`, `Comma` only — extensible for more punctuation later without engine changes)
- Unicode Hangul syllable compose/decompose, plus the compound-jungseong and compound-jongseong tables (which look like one jamo but are typed as two keystrokes)
- Compiling a known target string into its exact expected keystroke sequence
- A pure, jamo-level typing-session state machine for **one exercise**: correct-key advance, wrong-key reject-and-count-mistake (jamo-level blocking — a wrong key never mutates composed text or advances position), completion detection, and derived selectors for composed text / per-character highlight state / accuracy / progress
- A thin Zustand store wrapping that state machine for a single active session

**Explicitly out of scope (deferred to the next integration round):**

- Sequencing through a lesson's exercise list, advancing between exercises
- Aggregate lesson metrics (total accuracy/speed/mistakes/time across a lesson)
- Any UI component, "Start Lesson" button, or wiring into `LessonDetailPage`
- Calling `application/complete-lesson.ts` or any Firestore persistence
- Any punctuation beyond space/period/comma
- Virtual keyboard visualization / next-key highlighting UI (needs the engine's `getCharacterStates`/next-expected-key data, but the visualization itself is a UI concern for later)

## Architecture

```
src/domain/korean/
  keymap.ts            2-beolsik physical-key ↔ jamo/punctuation map
  hangul.ts             Unicode syllable compose/decompose + compound tables
  target-sequence.ts    target string → ordered list of expected keystrokes
  typing-session.ts     pure jamo-level state machine
src/features/typing/
  session-store.ts       Zustand wrapper (new features/typing/ folder — first typing-specific feature area, alongside the existing course/lesson ones)
```

Dependency direction: `keymap.ts` and `hangul.ts` have no dependencies on each other or anything else. `target-sequence.ts` depends on both. `typing-session.ts` depends on `target-sequence.ts` and `hangul.ts`. `session-store.ts` depends only on `typing-session.ts`. Nothing in `domain/korean/` imports React or Zustand — matches how the rest of `domain/` is framework-free.

## `keymap.ts`

The standard 2-beolsik layout, keyed by `KeyboardEvent.code` (physical position, independent of the OS's active input language):

**Choseong (initial consonant) keys** — 14 physical keys, 5 with a Shift variant (tense consonant):

| `code` | base | shift |
|---|---|---|
| KeyQ | ㅂ | ㅃ |
| KeyW | ㅈ | ㅉ |
| KeyE | ㄷ | ㄸ |
| KeyR | ㄱ | ㄲ |
| KeyT | ㅅ | ㅆ |
| KeyA | ㅁ | — |
| KeyS | ㄴ | — |
| KeyD | ㅇ | — |
| KeyF | ㄹ | — |
| KeyG | ㅎ | — |
| KeyZ | ㅋ | — |
| KeyX | ㅌ | — |
| KeyC | ㅊ | — |
| KeyV | ㅍ | — |

**Jungseong (vowel) keys** — 12 physical keys, 2 with a Shift variant:

| `code` | base | shift |
|---|---|---|
| KeyY | ㅛ | — |
| KeyU | ㅕ | — |
| KeyI | ㅑ | — |
| KeyO | ㅐ | ㅒ |
| KeyP | ㅔ | ㅖ |
| KeyH | ㅗ | — |
| KeyJ | ㅓ | — |
| KeyK | ㅏ | — |
| KeyL | ㅣ | — |
| KeyB | ㅠ | — |
| KeyN | ㅜ | — |
| KeyM | ㅡ | — |

**Punctuation/space** (this round): `Comma` → `,`, `Period` → `.`, `Space` → ` ` (no jamo role).

`keymap.ts` exports:

```ts
export const KEY_TO_JAMO: Record<string, { base: string; shift?: string }>
export const JAMO_TO_KEY: Record<string, { code: string; shift: boolean }>
```

`JAMO_TO_KEY` is derived from `KEY_TO_JAMO` at module load (invert both the base and shift entries) — the table is written once, not duplicated.

## `hangul.ts`

Standard Unicode Hangul syllable block algorithm. Fixed lookup tables:

```ts
export const CHOSEONG_LIST: string[]   // 19: ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ
export const JUNGSEONG_LIST: string[]  // 21: ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ
export const JONGSEONG_LIST: string[]  // 28: '' (none) + 27 batchim, index 0 = no final
```

```ts
export function decomposeSyllable(char: string): { choseong: string; jungseong: string; jongseong: string } | null
export function composeSyllable(choseong: string, jungseong: string, jongseong?: string): string
```

`composeSyllable` uses the standard formula: `codepoint = 0xAC00 + (choseongIndex * 21 + jungseongIndex) * 28 + jongseongIndex` (`jongseongIndex` 0 when no final). `decomposeSyllable` inverts it; returns `null` for a char outside the precomposed Hangul syllable block (punctuation, space, a lone jamo).

Compound tables — jamo that render as one glyph but are typed as two physical keystrokes:

```ts
export const COMPOUND_JUNGSEONG_PARTS: Record<string, [string, string]>
// 7: ㅘ→[ㅗ,ㅏ] ㅙ→[ㅗ,ㅐ] ㅚ→[ㅗ,ㅣ] ㅝ→[ㅜ,ㅓ] ㅞ→[ㅜ,ㅔ] ㅟ→[ㅜ,ㅣ] ㅢ→[ㅡ,ㅣ]

export const COMPOUND_JONGSEONG_PARTS: Record<string, [string, string]>
// 11: ㄳ→[ㄱ,ㅅ] ㄵ→[ㄴ,ㅈ] ㄶ→[ㄴ,ㅎ] ㄺ→[ㄹ,ㄱ] ㄻ→[ㄹ,ㅁ] ㄼ→[ㄹ,ㅂ] ㄽ→[ㄹ,ㅅ] ㄾ→[ㄹ,ㅌ] ㄿ→[ㄹ,ㅍ] ㅀ→[ㄹ,ㅎ] ㅄ→[ㅂ,ㅅ]
```

(ㅒ/ㅖ and the tense consonants ㄲ/ㅆ/etc. as a batchim are each reachable via a single `Shift`+key press per `keymap.ts` — they are *not* in these compound tables, which are specifically for glyphs requiring two separate key presses in sequence.)

## `target-sequence.ts`

```ts
export interface ExpectedKey {
  code: string
  shift: boolean
  jamo: string
  syllableIndex: number
}

export function buildExpectedKeys(targetText: string): ExpectedKey[]
```

For each character in `targetText`: if it decomposes as a Hangul syllable, look up choseong/jungseong/jongseong; for jungseong/jongseong found in the compound tables, expand to their 2 key parts; look up each resulting jamo's `{code, shift}` via `JAMO_TO_KEY`. Non-Hangul characters (space, period, comma) map directly via `JAMO_TO_KEY` as a single entry. Every entry produced from the same source character shares one `syllableIndex` (0-based, counts non-Hangul characters as their own "syllable" too, for uniform progress counting).

Because the target is always known in advance, this precompiles the *entire* expected keystroke sequence once — the runtime matcher (`typing-session.ts`) just walks it index by index. No ambiguity/backtracking (the hard part of a general-purpose Korean IME) is needed, since we're matching a known target, not composing free text.

## `typing-session.ts`

```ts
export type CharacterState = 'correct' | 'current' | 'pending'

export interface TypingSessionState {
  targetText: string
  expectedKeys: ExpectedKey[]
  keyIndex: number
  mistakeCount: number
  status: 'in-progress' | 'completed'
}

export function startTypingSession(targetText: string): TypingSessionState
export function pressKey(state: TypingSessionState, code: string, shiftKey: boolean): TypingSessionState

export function getComposedText(state: TypingSessionState): string
export function getCharacterStates(state: TypingSessionState): CharacterState[]
export function getAccuracy(state: TypingSessionState): number
export function getProgress(state: TypingSessionState): { typed: number; total: number }
```

`pressKey`: if `expectedKeys[keyIndex]` matches `{code, shift: shiftKey}`, return a new state with `keyIndex + 1` (and `status: 'completed'` once `keyIndex === expectedKeys.length`). Otherwise return a new state with `mistakeCount + 1` and everything else unchanged — the key press has no effect on composition or position (jamo-level blocking, per your decision: wrong keys count as mistakes but never mutate accepted text or advance).

`getComposedText`: for each completed syllable (all its `syllableIndex` group's keys consumed), compose it via `composeSyllable`; for the in-progress syllable, compose from whatever choseong/jungseong/jongseong keys have been entered so far. A Unicode syllable block requires at least a choseong+jungseong pair, so: choseong-only so far → display the bare choseong jamo character itself (not a composed block — there's nothing to compose yet); choseong+jungseong (±jongseong) → `composeSyllable(...)`. Non-Hangul characters pass through as-is once their single key is consumed.

`getCharacterStates`: one entry per character of `targetText` — `'correct'` if fully typed, `'current'` if it's the syllable currently being composed, `'pending'` otherwise. Feeds the UI's correct/current/pending highlighting from `docs/requirement.md` #2, when that UI is built later.

`getAccuracy`: `keyIndex / (keyIndex + mistakeCount)` (0 when both are 0). `getProgress`: `{ typed: <number of completed syllableIndex groups>, total: <total syllableIndex groups> }` — the "7/20" style display.

## `session-store.ts`

```ts
interface TypingSessionStore {
  session: TypingSessionState | null
  start: (targetText: string) => void
  pressKey: (code: string, shiftKey: boolean) => void
}
```

A thin Zustand store: `start` calls `startTypingSession` and stores the result; `pressKey` calls the pure `pressKey` reducer with the current session state and stores the result. No logic of its own — pure pass-through, matching `AGENTS.md`'s Zustand rule ("transient interactive session state ... current exercise, mistakes ... in-progress accuracy").

## Testing

Almost entirely pure-function unit tests (TDD), no component/RTL tests this round (no UI yet):

- `hangul.ts`: `composeSyllable`/`decomposeSyllable` round-trips on syllables with and without a final consonant, and on a syllable with a compound final (e.g. 값); `decomposeSyllable` returns `null` for non-syllable input.
- `keymap.ts`: spot-check lookups both directions; `JAMO_TO_KEY` correctly inverts `KEY_TO_JAMO` including shift variants.
- `target-sequence.ts`: a plain word (no compounds), a word needing a compound jungseong (e.g. 화 needs ㅎ+ㅗ+ㅏ two-key jungseong), a word needing a compound jongseong (e.g. 값 needs ㄱ+ㅅ two-key jongseong), and text containing space/period/comma.
- `typing-session.ts`: correct key sequence completes a session; a wrong key increments `mistakeCount` and leaves `keyIndex`/composed text unchanged; completion sets `status: 'completed'`; each derived selector against a partially-typed session.

## Follow-on work (not this round)

- Lesson exercise sequencing (advance through a lesson's exercise list) and aggregate lesson metrics.
- Wiring into `LessonDetailPage` — an actual "Start Lesson" interactive flow, calling `application/complete-lesson.ts` at the end.
- Virtual keyboard visualization component (next-key highlight, Shift highlight) — consumes this engine's data but isn't built here.
- Punctuation beyond space/period/comma (`?`, `!`, quotes, parentheses) — just new `keymap.ts` entries when needed.
