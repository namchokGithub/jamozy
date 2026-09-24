# Lesson Typing Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Korean typing engine into an interactive "Start Lesson" flow: sequence a lesson's exercises, show a virtual keyboard, and persist the result (Progress/EXP/ReviewItems) through a React Router action.

**Architecture:** A new pure domain file (`lesson-session.ts`) sequences exercises through the existing `typing-session.ts` engine and aggregates a `LessonResult`. Two new `application/` use cases (`create-review-items.ts`, `complete-lesson-session.ts`) persist it. A React Router `action` (not a loader-returned closure) is the only mutation path, invoked via `useFetcher`. Two new UI components (`VirtualKeyboard`, `LessonTypingSession`) render the interactive flow.

**Tech Stack:** React 19, TypeScript 5, React Router 8 (actions + `useFetcher`), Zustand, Zod 4, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-09-24-lesson-typing-session-design.md`

## Global Constraints

- `typing-session.ts`'s `mistakeCount: number` becomes `mistakes: MistakeEvent[]` — every existing `.mistakeCount` reference in `typing-session.test.ts` must be updated (7 occurrences).
- **Accuracy scale:** `lesson-session.ts`'s `getLessonResult` produces accuracy on a **0–100** scale (matching `Progress.bestAccuracy`/`UserStats.averageAccuracy`/`complete-lesson.ts`'s `calculateExpGained`), *not* the engine's internal 0–1 fraction (`typing-session.ts`'s own `getAccuracy()`, left unchanged).
- **WPM is keystroke-based**, not displayed-character-based: `(totalCorrectKeystrokes / 5) / minutes`.
- Only `src/app/router.ts` imports `infrastructure/firebase` — no new Firebase import anywhere in `features/` (matches the already-established rule from the previous round).
- Route mutations go through a React Router `action` + `useFetcher`, never a loader-returned closure.
- `ReviewItem` mistakes are looked up by deterministic id (`sourceExerciseId`) via a point `getReviewItem` lookup — never `getReviewItems()` + scan.
- No full Lesson Result screen, no Settings-driven keyboard toggles, no persisted per-jamo mistake detail — all deferred per the spec's Scope section.

## Review Focus

1. **Accuracy scale silently wrong** — if `getLessonResult` ever returned the engine's 0–1 fraction instead of 0–100, `complete-lesson.ts`'s EXP bonuses (`accuracy > 90`, `=== 100`) would become unreachable and `Progress`/`UserStats` accuracy fields would be corrupted with tiny fractions. Pinned in Task 2 with an exact-value assertion (not just "greater than 0").
2. **Double submission** — if the "lesson completed" effect isn't guarded, extra keydowns or re-renders could submit the action twice, double-awarding EXP or double-incrementing `ReviewItem.mistakeCount`. Pinned in Task 9.
3. **`ReviewItem` collection scan** — `create-review-items.ts` must never call `getReviewItems()` to find an existing item; only a point `getReviewItem` lookup by deterministic id. Pinned in Task 3.
4. **`keydown` listener never cleaned up** — a `window.addEventListener('keydown', ...)` without a cleanup function on unmount leaks into whatever page the learner navigates to next, corrupting its keyboard behavior. Pinned in Task 9.
5. **A lesson with zero exercises** — `LessonTypingSession` must not crash and should submit an all-zero result immediately rather than hang waiting for a first exercise that doesn't exist. Pinned in Task 9.

---

### Task 1: Amend `typing-session.ts` — richer mistake capture

**Files:**
- Modify: `src/domain/korean/typing-session.ts`
- Modify: `src/domain/korean/typing-session.test.ts`

**Interfaces:**
- Produces: `MistakeEvent` (new export), `TypingSessionState.mistakes: MistakeEvent[]` (replaces `mistakeCount: number`). Consumed by Task 2 (`lesson-session.ts`'s `ExerciseResult.mistakes`).

- [ ] **Step 1: Update the failing tests**

Replace `src/domain/korean/typing-session.test.ts` in full with:

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
    expect(state.mistakes).toEqual([])
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
    expect(state.mistakes).toEqual([])
  })

  it('rejects a wrong key: records the full mistake detail, does not advance or mutate composed text', () => {
    let state = startTypingSession('가') // ㄱ (KeyR) + ㅏ (KeyK)
    state = pressKey(state, 'KeyT', false) // wrong — ㅅ, not ㄱ

    expect(state.keyIndex).toBe(0)
    expect(state.mistakes).toEqual([
      {
        syllableIndex: 0,
        expectedCode: 'KeyR',
        expectedShift: false,
        expectedJamo: 'ㄱ',
        pressedCode: 'KeyT',
        pressedShift: false,
      },
    ])
    expect(getComposedText(state)).toBe('')
  })

  it('treats the correct code with the wrong Shift state as a mistake', () => {
    let state = startTypingSession('빵') // choseong ㅃ = Shift+KeyQ
    state = pressKey(state, 'KeyQ', false) // right key, missing Shift

    expect(state.keyIndex).toBe(0)
    expect(state.mistakes).toHaveLength(1)

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

  it('accepts a held Shift on a key with no Shift variant (still matches)', () => {
    let state = startTypingSession('까') // choseong ㄲ = Shift+KeyR, jungseong ㅏ = KeyK (no shift variant)
    state = pressKey(state, 'KeyR', true) // ㄲ
    expect(state.keyIndex).toBe(1)

    state = pressKey(state, 'KeyK', true) // ㅏ, Shift still held from the previous key — should still match
    expect(state.keyIndex).toBe(2)
    expect(state.mistakes).toEqual([])
  })

  it('still requires the exact Shift state for a key that has a Shift variant', () => {
    let state = startTypingSession('가') // choseong ㄱ = KeyR (unshifted) — ㄲ is Shift+KeyR
    state = pressKey(state, 'KeyR', true) // right key, wrong Shift state (asks for ㄲ, not ㄱ)

    expect(state.keyIndex).toBe(0)
    expect(state.mistakes).toHaveLength(1)
  })

  it('ignores a bare modifier keydown rather than counting it as a mistake', () => {
    let state = startTypingSession('가')
    state = pressKey(state, 'ShiftLeft', true)

    expect(state.keyIndex).toBe(0)
    expect(state.mistakes).toEqual([])
  })
})

describe('getComposedText', () => {
  it('shows only the choseong while the jungseong has not been typed yet', () => {
    let state = startTypingSession('가')
    state = pressKey(state, 'KeyR', false)
    expect(getComposedText(state)).toBe('ㄱ')
  })

  it('composes progressively with the first half of a compound jongseong, then the full syllable', () => {
    let state = startTypingSession('값') // ㄱ, ㅏ, ㅂ+ㅅ (compound jongseong)
    state = pressKey(state, 'KeyR', false) // ㄱ
    state = pressKey(state, 'KeyK', false) // ㅏ
    state = pressKey(state, 'KeyQ', false) // ㅂ (1st half of ㅄ) — ㅂ is itself a valid final, so this shows 갑

    expect(getComposedText(state)).toBe('갑')
    expect(getCharacterStates(state)).toEqual(['current'])

    state = pressKey(state, 'KeyT', false) // ㅅ (2nd half of ㅄ)
    expect(getComposedText(state)).toBe('값')
    expect(getCharacterStates(state)).toEqual(['correct'])
  })

  it('composes progressively with the first half of a compound jungseong, then the full syllable', () => {
    let state = startTypingSession('화') // ㅎ, ㅗ+ㅏ (compound jungseong)
    state = pressKey(state, 'KeyG', false) // ㅎ
    expect(getComposedText(state)).toBe('ㅎ')

    state = pressKey(state, 'KeyH', false) // ㅗ (1st half of ㅘ) — ㅗ is itself a valid vowel, so this shows 호
    expect(getComposedText(state)).toBe('호')

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
Expected: FAIL — several tests reference `state.mistakes`, which doesn't exist yet (current state still has `mistakeCount`).

- [ ] **Step 3: Amend the implementation**

Replace `src/domain/korean/typing-session.ts` in full with:

```ts
import { buildExpectedKeys, type ExpectedKey } from './target-sequence'
import { COMPOUND_JONGSEONG_PARTS, COMPOUND_JUNGSEONG_PARTS, composeSyllable } from './hangul'

export type CharacterState = 'correct' | 'current' | 'pending'

export interface MistakeEvent {
  syllableIndex: number
  expectedCode: string
  expectedShift: boolean
  expectedJamo: string
  pressedCode: string
  pressedShift: boolean
}

export interface TypingSessionState {
  targetText: string
  expectedKeys: ExpectedKey[]
  keyIndex: number
  mistakes: MistakeEvent[]
  status: 'in-progress' | 'completed'
}

export function startTypingSession(targetText: string): TypingSessionState {
  const expectedKeys = buildExpectedKeys(targetText)
  return {
    targetText,
    expectedKeys,
    keyIndex: 0,
    mistakes: [],
    status: expectedKeys.length === 0 ? 'completed' : 'in-progress',
  }
}

const MODIFIER_CODES = new Set([
  'ShiftLeft', 'ShiftRight',
  'ControlLeft', 'ControlRight',
  'AltLeft', 'AltRight',
  'MetaLeft', 'MetaRight',
  'CapsLock',
])

export function pressKey(state: TypingSessionState, code: string, shiftKey: boolean): TypingSessionState {
  if (state.status === 'completed' || MODIFIER_CODES.has(code)) {
    return state
  }

  const expected = state.expectedKeys[state.keyIndex]
  const shiftMatches = expected.strictShift ? expected.shift === shiftKey : true
  if (expected.code === code && shiftMatches) {
    const keyIndex = state.keyIndex + 1
    return {
      ...state,
      keyIndex,
      status: keyIndex === state.expectedKeys.length ? 'completed' : 'in-progress',
    }
  }

  const mistake: MistakeEvent = {
    syllableIndex: expected.syllableIndex,
    expectedCode: expected.code,
    expectedShift: expected.shift,
    expectedJamo: expected.jamo,
    pressedCode: code,
    pressedShift: shiftKey,
  }
  return { ...state, mistakes: [...state.mistakes, mistake] }
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

// The first key of any 2-key compound jungseong/jongseong (ㅗ ㅜ ㅡ; ㄱ ㄴ ㄹ ㅂ)
// is itself a complete, valid jamo in that slot — so it's safe to compose
// with just that one key while its compound partner hasn't landed yet,
// rather than showing no visible change for a correct keystroke.
function partialJamo(typed: ExpectedKey[], total: number): string | undefined {
  if (typed.length === 0) return undefined
  if (typed.length === total) return recombine(typed)
  return typed[0].jamo
}

function composePartialSyllable(typedGroup: ExpectedKey[], fullGroup: ExpectedKey[]): string {
  const choseong = typedGroup.find((k) => k.slot === 'choseong')
  if (!choseong) return ''

  const jungseongTotal = fullGroup.filter((k) => k.slot === 'jungseong').length
  const jungseongTyped = typedGroup.filter((k) => k.slot === 'jungseong')
  const jungseong = partialJamo(jungseongTyped, jungseongTotal)
  if (!jungseong) return choseong.jamo

  const jongseongTotal = fullGroup.filter((k) => k.slot === 'jongseong').length
  const jongseongTyped = typedGroup.filter((k) => k.slot === 'jongseong')
  const jongseong = partialJamo(jongseongTyped, jongseongTotal)

  return composeSyllable(choseong.jamo, jungseong, jongseong)
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
  const attempts = state.keyIndex + state.mistakes.length
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
Expected: PASS (16 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors. (`target-sequence.test.ts`/`hangul.test.ts`/`keymap.test.ts` are untouched by this task and still pass — this change is isolated to `TypingSessionState`'s own shape.)

- [ ] **Step 6: Commit**

```bash
git add src/domain/korean/typing-session.ts src/domain/korean/typing-session.test.ts
git commit -m "feat(korean): capture full mistake detail instead of a bare count"
```

---

### Task 2: `lesson-session.ts` — exercise sequencing and lesson-level aggregation

**Files:**
- Create: `src/domain/korean/lesson-session.ts`
- Test: `src/domain/korean/lesson-session.test.ts`

**Interfaces:**
- Consumes: `startTypingSession`, `pressKey` (aliased), `TypingSessionState`, `MistakeEvent` (Task 1).
- Produces: `ExerciseResult`, `LessonSessionState`, `startLessonSession(exercises, now?)`, `pressKey(state, code, shiftKey)`, `MistakeReport`, `LessonResult`, `getLessonResult(state, now?)`, `getLessonProgress(state)`, `lessonResultSchema` (Zod). Consumed by Tasks 3, 4, 5, 8, 9.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  getLessonProgress,
  getLessonResult,
  pressKey,
  startLessonSession,
  lessonResultSchema,
  type LessonSessionState,
} from './lesson-session'
import { startTypingSession, type MistakeEvent } from './typing-session'

describe('startLessonSession', () => {
  it('starts typing with the first exercise loaded', () => {
    const state = startLessonSession([
      { id: 'e1', targetText: '가' },
      { id: 'e2', targetText: '나' },
    ])
    expect(state.status).toBe('typing')
    expect(state.currentIndex).toBe(0)
    expect(state.currentSession.targetText).toBe('가')
    expect(state.completedResults).toEqual([])
  })

  it('starts already completed for an empty exercise list', () => {
    const state = startLessonSession([])
    expect(state.status).toBe('completed')
  })
})

describe('pressKey', () => {
  it('auto-advances to the next exercise and records results as each completes', () => {
    let state = startLessonSession([
      { id: 'e1', targetText: '가' }, // ㄱ(KeyR) ㅏ(KeyK)
      { id: 'e2', targetText: '나' }, // ㄴ(KeyS) ㅏ(KeyK)
    ])

    state = pressKey(state, 'KeyR', false)
    state = pressKey(state, 'KeyK', false) // 가 complete — auto-advance
    expect(state.currentIndex).toBe(1)
    expect(state.status).toBe('typing')
    expect(state.completedResults).toEqual([
      { exerciseId: 'e1', targetText: '가', correctKeyCount: 2, mistakes: [] },
    ])
    expect(state.currentSession.targetText).toBe('나')

    state = pressKey(state, 'KeyS', false)
    state = pressKey(state, 'KeyK', false) // 나 complete — lesson done
    expect(state.status).toBe('completed')
    expect(state.completedResults).toHaveLength(2)
  })

  it('ignores pressKey once the lesson session is completed', () => {
    let state = startLessonSession([{ id: 'e1', targetText: '가' }])
    state = pressKey(state, 'KeyR', false)
    state = pressKey(state, 'KeyK', false)
    expect(state.status).toBe('completed')

    const completed = state
    state = pressKey(state, 'KeyR', false)
    expect(state).toEqual(completed)
  })
})

function makeMistake(): MistakeEvent {
  return {
    syllableIndex: 0,
    expectedCode: 'KeyR',
    expectedShift: false,
    expectedJamo: 'ㄱ',
    pressedCode: 'KeyT',
    pressedShift: false,
  }
}

describe('getLessonResult', () => {
  it('computes accuracy on a 0-100 scale (not the engine\'s internal 0-1) and lists exercises with mistakes', () => {
    const state: LessonSessionState = {
      exercises: [],
      currentIndex: 0,
      currentSession: startTypingSession(''),
      completedResults: [
        { exerciseId: 'e1', targetText: '가', correctKeyCount: 9, mistakes: [] },
        { exerciseId: 'e2', targetText: '나', correctKeyCount: 0, mistakes: [makeMistake()] },
      ],
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
      status: 'completed',
    }

    const result = getLessonResult(state, new Date('2026-01-01T00:01:00.000Z'))

    expect(result.accuracy).toBe(90) // 9 correct / (9 correct + 1 mistake) * 100
    expect(result.mistakes).toEqual([{ sourceExerciseId: 'e2', targetText: '나' }])
  })

  it('computes WPM from physical keystrokes, not displayed characters', () => {
    const state: LessonSessionState = {
      exercises: [],
      currentIndex: 0,
      currentSession: startTypingSession(''),
      completedResults: [
        { exerciseId: 'e1', targetText: '값', correctKeyCount: 10, mistakes: [] },
      ],
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
      status: 'completed',
    }

    const result = getLessonResult(state, new Date('2026-01-01T00:01:00.000Z')) // 60s later

    expect(result.durationSeconds).toBe(60)
    expect(result.speedWpm).toBe(2) // (10 keystrokes / 5) / (60s / 60) = 2
  })

  it('returns all zeros for a lesson with no exercises', () => {
    const state = startLessonSession([])
    const result = getLessonResult(state, state.startedAt) // same instant, duration 0
    expect(result).toEqual({ accuracy: 0, speedWpm: 0, durationSeconds: 0, mistakes: [] })
  })
})

describe('getLessonProgress', () => {
  it('reports completed exercises against the total', () => {
    let state = startLessonSession([
      { id: 'e1', targetText: '가' },
      { id: 'e2', targetText: '나' },
    ])
    expect(getLessonProgress(state)).toEqual({ current: 0, total: 2 })

    state = pressKey(state, 'KeyR', false)
    state = pressKey(state, 'KeyK', false)
    expect(getLessonProgress(state)).toEqual({ current: 1, total: 2 })
  })
})

describe('lessonResultSchema', () => {
  it('accepts a valid result', () => {
    expect(() =>
      lessonResultSchema.parse({ accuracy: 90, speedWpm: 2, durationSeconds: 60, mistakes: [] }),
    ).not.toThrow()
  })

  it('rejects an out-of-range accuracy', () => {
    expect(() =>
      lessonResultSchema.parse({ accuracy: 150, speedWpm: 2, durationSeconds: 60, mistakes: [] }),
    ).toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/domain/korean/lesson-session.test.ts`
Expected: FAIL — `src/domain/korean/lesson-session.ts` does not exist yet.

- [ ] **Step 3: Implement `lesson-session.ts`**

```ts
import { z } from 'zod'
import {
  pressKey as typingSessionPressKey,
  startTypingSession,
  type MistakeEvent,
  type TypingSessionState,
} from './typing-session'
import type { LessonExercise } from '../models/lesson'

export interface ExerciseResult {
  exerciseId: string
  targetText: string
  correctKeyCount: number
  mistakes: MistakeEvent[]
}

export interface LessonSessionState {
  exercises: Array<Pick<LessonExercise, 'id' | 'targetText'>>
  currentIndex: number
  currentSession: TypingSessionState
  completedResults: ExerciseResult[]
  startedAt: Date
  status: 'typing' | 'completed'
}

export function startLessonSession(
  exercises: Array<Pick<LessonExercise, 'id' | 'targetText'>>,
  now: Date = new Date(),
): LessonSessionState {
  return {
    exercises,
    currentIndex: 0,
    currentSession: startTypingSession(exercises[0]?.targetText ?? ''),
    completedResults: [],
    startedAt: now,
    status: exercises.length === 0 ? 'completed' : 'typing',
  }
}

export function pressKey(state: LessonSessionState, code: string, shiftKey: boolean): LessonSessionState {
  if (state.status === 'completed') {
    return state
  }

  const nextSession = typingSessionPressKey(state.currentSession, code, shiftKey)
  if (nextSession.status !== 'completed') {
    return { ...state, currentSession: nextSession }
  }

  const exercise = state.exercises[state.currentIndex]
  const result: ExerciseResult = {
    exerciseId: exercise.id,
    targetText: exercise.targetText,
    correctKeyCount: nextSession.keyIndex,
    mistakes: nextSession.mistakes,
  }
  const completedResults = [...state.completedResults, result]
  const nextIndex = state.currentIndex + 1

  if (nextIndex >= state.exercises.length) {
    return { ...state, currentSession: nextSession, completedResults, status: 'completed' }
  }

  return {
    ...state,
    currentIndex: nextIndex,
    currentSession: startTypingSession(state.exercises[nextIndex].targetText),
    completedResults,
  }
}

export interface MistakeReport {
  sourceExerciseId: string
  targetText: string
}

export interface LessonResult {
  accuracy: number
  speedWpm: number
  durationSeconds: number
  mistakes: MistakeReport[]
}

export function getLessonResult(state: LessonSessionState, now: Date = new Date()): LessonResult {
  const totalCorrectKeystrokes = state.completedResults.reduce((sum, r) => sum + r.correctKeyCount, 0)
  const totalMistakes = state.completedResults.reduce((sum, r) => sum + r.mistakes.length, 0)
  const accuracy =
    totalCorrectKeystrokes + totalMistakes === 0
      ? 0
      : (totalCorrectKeystrokes / (totalCorrectKeystrokes + totalMistakes)) * 100

  const durationSeconds = (now.getTime() - state.startedAt.getTime()) / 1000
  const speedWpm = durationSeconds === 0 ? 0 : (totalCorrectKeystrokes / 5) / (durationSeconds / 60)

  const mistakes = state.completedResults
    .filter((r) => r.mistakes.length > 0)
    .map((r) => ({ sourceExerciseId: r.exerciseId, targetText: r.targetText }))

  return { accuracy, speedWpm, durationSeconds, mistakes }
}

export function getLessonProgress(state: LessonSessionState): { current: number; total: number } {
  return { current: state.completedResults.length, total: state.exercises.length }
}

export const lessonResultSchema = z.object({
  accuracy: z.number().min(0).max(100),
  speedWpm: z.number().min(0),
  durationSeconds: z.number().min(0),
  mistakes: z.array(
    z.object({
      sourceExerciseId: z.string(),
      targetText: z.string(),
    }),
  ),
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/domain/korean/lesson-session.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/domain/korean/lesson-session.ts src/domain/korean/lesson-session.test.ts
git commit -m "feat(korean): sequence a lesson's exercises and aggregate the result"
```

---

### Task 3: `ReviewRepository.getReviewItem` + `create-review-items.ts`

**Files:**
- Modify: `src/domain/repositories/review-repository.ts`
- Modify: `src/test/fakes.ts` (add `FakeReviewRepository.getReviewItem`)
- Modify: `src/infrastructure/firebase/repositories/firebase-review-repository.ts`
- Create: `src/application/create-review-items.ts`
- Test: `src/application/create-review-items.test.ts`

**Interfaces:**
- Consumes: `MistakeReport` (Task 2), `nextReviewDate` (`src/domain/models/review-item.ts`, already exists), `ReviewItem` (already exists).
- Produces: `ReviewRepository.getReviewItem(userId, itemId): Promise<ReviewItem | null>`, `createReviewItemsFromMistakes(reviewRepo, userId, lessonId, mistakes, now?): Promise<void>`. Consumed by Task 4.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi } from 'vitest'
import { createReviewItemsFromMistakes } from './create-review-items'
import { FakeReviewRepository } from '../test/fakes'

describe('createReviewItemsFromMistakes', () => {
  const now = new Date('2026-01-01')

  it('creates a fresh ReviewItem when none exists for the exercise', async () => {
    const reviewRepo = new FakeReviewRepository()

    await createReviewItemsFromMistakes(
      reviewRepo,
      'user1',
      'lesson1',
      [{ sourceExerciseId: 'ex1', targetText: '가' }],
      now,
    )

    const item = await reviewRepo.getReviewItem('user1', 'ex1')
    expect(item).toMatchObject({
      id: 'ex1',
      sourceLessonId: 'lesson1',
      sourceExerciseId: 'ex1',
      targetText: '가',
      reason: 'mistake',
      mistakeCount: 1,
      resolved: false,
      box: 1,
    })
  })

  it('increments mistakeCount and resets box to 1 for an existing ReviewItem', async () => {
    const reviewRepo = new FakeReviewRepository()
    await reviewRepo.addReviewItem('user1', {
      id: 'ex1',
      sourceLessonId: 'lesson1',
      sourceExerciseId: 'ex1',
      targetText: '가',
      reason: 'mistake',
      mistakeCount: 2,
      lastMistakeAt: new Date('2025-01-01'),
      resolved: true,
      box: 4,
      nextReviewAt: new Date('2025-02-01'),
    })

    await createReviewItemsFromMistakes(
      reviewRepo,
      'user1',
      'lesson1',
      [{ sourceExerciseId: 'ex1', targetText: '가' }],
      now,
    )

    const item = await reviewRepo.getReviewItem('user1', 'ex1')
    expect(item?.mistakeCount).toBe(3)
    expect(item?.box).toBe(1)
    expect(item?.resolved).toBe(false)
  })

  it('never calls getReviewItems (only point lookups by id)', async () => {
    const reviewRepo = new FakeReviewRepository()
    const getReviewItemsSpy = vi.spyOn(reviewRepo, 'getReviewItems')

    await createReviewItemsFromMistakes(
      reviewRepo,
      'user1',
      'lesson1',
      [{ sourceExerciseId: 'ex1', targetText: '가' }],
      now,
    )

    expect(getReviewItemsSpy).not.toHaveBeenCalled()
  })

  it('does nothing for an empty mistakes list', async () => {
    const reviewRepo = new FakeReviewRepository()
    const getReviewItemSpy = vi.spyOn(reviewRepo, 'getReviewItem')

    await createReviewItemsFromMistakes(reviewRepo, 'user1', 'lesson1', [], now)

    expect(getReviewItemSpy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/application/create-review-items.test.ts`
Expected: FAIL — `getReviewItem` doesn't exist on `FakeReviewRepository`, and `src/application/create-review-items.ts` doesn't exist.

- [ ] **Step 3: Add `getReviewItem` to the interface, the fake, and the Firebase implementation**

`src/domain/repositories/review-repository.ts` — replace in full:

```ts
import type { ReviewItem } from '../models/review-item'

export interface ReviewRepository {
  getReviewItems(userId: string): Promise<ReviewItem[]>
  getReviewItem(userId: string, itemId: string): Promise<ReviewItem | null>
  addReviewItem(userId: string, item: ReviewItem): Promise<void>
  updateReviewItem(userId: string, item: ReviewItem): Promise<void>
}
```

`src/test/fakes.ts` — add this method to the existing `FakeReviewRepository` class (alongside its existing methods, same file):

```ts
  async getReviewItem(userId: string, itemId: string): Promise<ReviewItem | null> {
    return this.store.get(`${userId}:${itemId}`) ?? null
  }
```

`src/infrastructure/firebase/repositories/firebase-review-repository.ts` — replace in full:

```ts
import { collection, doc, getDoc, getDocs, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import type { ReviewRepository } from '../../../domain/repositories/review-repository'
import type { ReviewItem } from '../../../domain/models/review-item'

function toReviewItem(id: string, data: Record<string, unknown>): ReviewItem {
  return {
    id,
    sourceLessonId: data.sourceLessonId as string,
    sourceExerciseId: data.sourceExerciseId as string,
    targetText: data.targetText as string,
    reason: data.reason as ReviewItem['reason'],
    mistakeCount: data.mistakeCount as number,
    lastMistakeAt: (data.lastMistakeAt as { toDate(): Date }).toDate(),
    resolved: data.resolved as boolean,
    box: data.box as number,
    nextReviewAt: (data.nextReviewAt as { toDate(): Date }).toDate(),
  }
}

function toReviewItemDoc(item: ReviewItem) {
  return {
    sourceLessonId: item.sourceLessonId,
    sourceExerciseId: item.sourceExerciseId,
    targetText: item.targetText,
    reason: item.reason,
    mistakeCount: item.mistakeCount,
    lastMistakeAt: Timestamp.fromDate(item.lastMistakeAt),
    resolved: item.resolved,
    box: item.box,
    nextReviewAt: Timestamp.fromDate(item.nextReviewAt),
  }
}

export class FirebaseReviewRepository implements ReviewRepository {
  async getReviewItems(userId: string): Promise<ReviewItem[]> {
    const snapshot = await getDocs(
      collection(db, 'users', userId, 'reviewItems'),
    )
    return snapshot.docs.map((d) => toReviewItem(d.id, d.data()))
  }

  async getReviewItem(userId: string, itemId: string): Promise<ReviewItem | null> {
    const snapshot = await getDoc(doc(db, 'users', userId, 'reviewItems', itemId))
    return snapshot.exists() ? toReviewItem(snapshot.id, snapshot.data()) : null
  }

  async addReviewItem(userId: string, item: ReviewItem): Promise<void> {
    await setDoc(
      doc(db, 'users', userId, 'reviewItems', item.id),
      toReviewItemDoc(item),
    )
  }

  async updateReviewItem(userId: string, item: ReviewItem): Promise<void> {
    await setDoc(
      doc(db, 'users', userId, 'reviewItems', item.id),
      toReviewItemDoc(item),
    )
  }
}
```

- [ ] **Step 4: Implement `create-review-items.ts`**

```ts
import type { ReviewRepository } from '../domain/repositories/review-repository'
import { nextReviewDate } from '../domain/models/review-item'
import type { ReviewItem } from '../domain/models/review-item'
import type { MistakeReport } from '../domain/korean/lesson-session'

export async function createReviewItemsFromMistakes(
  reviewRepo: ReviewRepository,
  userId: string,
  lessonId: string,
  mistakes: MistakeReport[],
  now: Date = new Date(),
): Promise<void> {
  for (const mistake of mistakes) {
    const existing = await reviewRepo.getReviewItem(userId, mistake.sourceExerciseId)

    if (existing) {
      const updated: ReviewItem = {
        ...existing,
        mistakeCount: existing.mistakeCount + 1,
        lastMistakeAt: now,
        resolved: false,
        box: 1,
        nextReviewAt: nextReviewDate(1, now),
      }
      await reviewRepo.updateReviewItem(userId, updated)
      continue
    }

    const created: ReviewItem = {
      id: mistake.sourceExerciseId,
      sourceLessonId: lessonId,
      sourceExerciseId: mistake.sourceExerciseId,
      targetText: mistake.targetText,
      reason: 'mistake',
      mistakeCount: 1,
      lastMistakeAt: now,
      resolved: false,
      box: 1,
      nextReviewAt: nextReviewDate(1, now),
    }
    await reviewRepo.addReviewItem(userId, created)
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run src/application/create-review-items.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Run the full suite (this task touches a shared fake used everywhere)**

Run: `pnpm exec vitest run`
Expected: PASS, no regressions in any other file that uses `FakeReviewRepository`.

- [ ] **Step 7: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/domain/repositories/review-repository.ts src/test/fakes.ts src/infrastructure/firebase/repositories/firebase-review-repository.ts src/application/create-review-items.ts src/application/create-review-items.test.ts
git commit -m "feat(review): add ReviewRepository.getReviewItem and create-review-items use case"
```

---

### Task 4: `complete-lesson-session.ts` — orchestrating use case

**Files:**
- Create: `src/application/complete-lesson-session.ts`
- Test: `src/application/complete-lesson-session.test.ts`

**Interfaces:**
- Consumes: `completeLesson`, `CompleteLessonDeps`, `CompleteLessonOutcome` (`src/application/complete-lesson.ts`, already exists), `createReviewItemsFromMistakes` (Task 3), `LessonResult` (Task 2), `ReviewRepository` (Task 3).
- Produces: `CompleteLessonSessionDeps`, `completeLessonSession(deps, userId, lessonId, result, now?): Promise<CompleteLessonOutcome>`. Consumed by Task 6.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { completeLessonSession } from './complete-lesson-session'
import {
  FakeCourseRepository,
  FakeLessonRepository,
  FakeProgressRepository,
  FakeUserProfileRepository,
  FakeReviewRepository,
} from '../test/fakes'
import type { Lesson } from '../domain/models/lesson'
import type { Unit } from '../domain/models/unit'

function makeUnit(id: string): Unit {
  return {
    id,
    courseId: 'c1',
    title: id,
    description: '',
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeLesson(id: string, unitId: string): Lesson {
  return {
    id,
    unitId,
    title: id,
    type: 'word',
    order: 1,
    exercises: [
      {
        id: 'ex1',
        targetText: '가',
        romanization: null,
        meaningTh: '',
        meaningEn: '',
        difficulty: 'easy',
        hint: null,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('completeLessonSession', () => {
  it('completes the lesson and creates a review item for each reported mistake', async () => {
    const deps = {
      courseRepo: new FakeCourseRepository([], [makeUnit('u1')]),
      lessonRepo: new FakeLessonRepository([makeLesson('l1', 'u1')]),
      progressRepo: new FakeProgressRepository(),
      userProfileRepo: new FakeUserProfileRepository(),
      reviewRepo: new FakeReviewRepository(),
    }

    const outcome = await completeLessonSession(deps, 'user1', 'l1', {
      accuracy: 90,
      speedWpm: 20,
      durationSeconds: 30,
      mistakes: [{ sourceExerciseId: 'ex1', targetText: '가' }],
    })

    expect(outcome.progress.status).toBe('completed')
    const reviewItem = await deps.reviewRepo.getReviewItem('user1', 'ex1')
    expect(reviewItem).not.toBeNull()
  })

  it('creates no review items when there are no mistakes', async () => {
    const deps = {
      courseRepo: new FakeCourseRepository([], [makeUnit('u1')]),
      lessonRepo: new FakeLessonRepository([makeLesson('l1', 'u1')]),
      progressRepo: new FakeProgressRepository(),
      userProfileRepo: new FakeUserProfileRepository(),
      reviewRepo: new FakeReviewRepository(),
    }

    await completeLessonSession(deps, 'user1', 'l1', {
      accuracy: 100,
      speedWpm: 20,
      durationSeconds: 30,
      mistakes: [],
    })

    const reviewItems = await deps.reviewRepo.getReviewItems('user1')
    expect(reviewItems).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/application/complete-lesson-session.test.ts`
Expected: FAIL — `src/application/complete-lesson-session.ts` does not exist yet.

- [ ] **Step 3: Implement `complete-lesson-session.ts`**

```ts
import { completeLesson, type CompleteLessonDeps, type CompleteLessonOutcome } from './complete-lesson'
import { createReviewItemsFromMistakes } from './create-review-items'
import type { ReviewRepository } from '../domain/repositories/review-repository'
import type { LessonResult } from '../domain/korean/lesson-session'

export interface CompleteLessonSessionDeps extends CompleteLessonDeps {
  reviewRepo: ReviewRepository
}

export async function completeLessonSession(
  deps: CompleteLessonSessionDeps,
  userId: string,
  lessonId: string,
  result: LessonResult,
  now: Date = new Date(),
): Promise<CompleteLessonOutcome> {
  const outcome = await completeLesson(deps, userId, lessonId, result, now)
  await createReviewItemsFromMistakes(deps.reviewRepo, userId, lessonId, result.mistakes, now)
  return outcome
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/application/complete-lesson-session.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/application/complete-lesson-session.ts src/application/complete-lesson-session.test.ts
git commit -m "feat(application): add complete-lesson-session orchestrating use case"
```

---

### Task 5: `lesson-session-store.ts` — Zustand wrapper

**Files:**
- Create: `src/features/typing/lesson-session-store.ts`
- Test: `src/features/typing/lesson-session-store.test.ts`

**Interfaces:**
- Consumes: `startLessonSession`, `pressKey` (aliased), `LessonSessionState` (Task 2).
- Produces: `useLessonSessionStore` (Zustand hook: `session`, `start(exercises)`, `pressKey(code, shiftKey)`). Consumed by Task 9.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { useLessonSessionStore } from './lesson-session-store'

describe('useLessonSessionStore', () => {
  it('starts a lesson session and applies pressKey to it', () => {
    useLessonSessionStore.getState().start([{ id: 'e1', targetText: '가' }])
    expect(useLessonSessionStore.getState().session?.status).toBe('typing')

    useLessonSessionStore.getState().pressKey('KeyR', false)
    expect(useLessonSessionStore.getState().session?.currentSession.keyIndex).toBe(1)
  })

  it('ignores pressKey when no session has been started', () => {
    useLessonSessionStore.setState({ session: null })
    useLessonSessionStore.getState().pressKey('KeyR', false)
    expect(useLessonSessionStore.getState().session).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/features/typing/lesson-session-store.test.ts`
Expected: FAIL — `src/features/typing/lesson-session-store.ts` does not exist yet.

- [ ] **Step 3: Implement `lesson-session-store.ts`**

```ts
import { create } from 'zustand'
import {
  pressKey as pressKeyReducer,
  startLessonSession,
  type LessonSessionState,
} from '../../domain/korean/lesson-session'
import type { LessonExercise } from '../../domain/models/lesson'

interface LessonSessionStore {
  session: LessonSessionState | null
  start: (exercises: Array<Pick<LessonExercise, 'id' | 'targetText'>>) => void
  pressKey: (code: string, shiftKey: boolean) => void
}

export const useLessonSessionStore = create<LessonSessionStore>((set, get) => ({
  session: null,
  start: (exercises) => set({ session: startLessonSession(exercises) }),
  pressKey: (code, shiftKey) => {
    const { session } = get()
    if (!session) return
    set({ session: pressKeyReducer(session, code, shiftKey) })
  },
}))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/features/typing/lesson-session-store.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/typing/lesson-session-store.ts src/features/typing/lesson-session-store.test.ts
git commit -m "feat(typing): add Zustand store wrapping lesson-session.ts"
```

---

### Task 6: `LessonDetailPage.action.ts` — the mutation entry point

**Files:**
- Create: `src/features/lesson/LessonDetailPage.action.ts`
- Test: `src/features/lesson/LessonDetailPage.action.test.ts`

**Interfaces:**
- Consumes: `completeLessonSession`, `CompleteLessonSessionDeps` (Task 4), `lessonResultSchema` (Task 2), `CompleteLessonOutcome` (`src/application/complete-lesson.ts`).
- Produces: `createCompleteLessonSessionAction(deps)` returning a React Router `ActionFunction`. Consumed by Task 9 (`router.ts`).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi } from 'vitest'
import { createCompleteLessonSessionAction } from './LessonDetailPage.action'
import {
  FakeCourseRepository,
  FakeLessonRepository,
  FakeProgressRepository,
  FakeUserProfileRepository,
  FakeReviewRepository,
} from '../../test/fakes'
import type { Lesson } from '../../domain/models/lesson'
import type { Unit } from '../../domain/models/unit'

function makeUnit(id: string): Unit {
  return { id, courseId: 'c1', title: id, description: '', order: 1, createdAt: new Date(), updatedAt: new Date() }
}

function makeLesson(id: string, unitId: string): Lesson {
  return { id, unitId, title: id, type: 'word', order: 1, exercises: [], createdAt: new Date(), updatedAt: new Date() }
}

function makeDeps() {
  return {
    courseRepo: new FakeCourseRepository([], [makeUnit('u1')]),
    lessonRepo: new FakeLessonRepository([makeLesson('l1', 'u1')]),
    progressRepo: new FakeProgressRepository(),
    userProfileRepo: new FakeUserProfileRepository(),
    reviewRepo: new FakeReviewRepository(),
    ensureUser: vi.fn().mockResolvedValue({ uid: 'user1' }),
  }
}

describe('createCompleteLessonSessionAction', () => {
  it('signs in, parses the request body, and completes the lesson session', async () => {
    const deps = makeDeps()
    const action = createCompleteLessonSessionAction(deps)
    const request = new Request('http://localhost/lessons/l1', {
      method: 'POST',
      body: JSON.stringify({ accuracy: 100, speedWpm: 20, durationSeconds: 30, mistakes: [] }),
    })

    const outcome = await action({ params: { lessonId: 'l1' }, request } as never)

    expect(deps.ensureUser).toHaveBeenCalledOnce()
    expect(outcome.progress.status).toBe('completed')
  })

  it('throws when lessonId is missing from params', async () => {
    const deps = makeDeps()
    const action = createCompleteLessonSessionAction(deps)
    const request = new Request('http://localhost/lessons/x', { method: 'POST', body: '{}' })

    await expect(action({ params: {}, request } as never)).rejects.toThrow('Lesson id is required')
  })

  it('rejects a malformed request body', async () => {
    const deps = makeDeps()
    const action = createCompleteLessonSessionAction(deps)
    const request = new Request('http://localhost/lessons/l1', {
      method: 'POST',
      body: JSON.stringify({ accuracy: 'not-a-number' }),
    })

    await expect(action({ params: { lessonId: 'l1' }, request } as never)).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/features/lesson/LessonDetailPage.action.test.ts`
Expected: FAIL — `src/features/lesson/LessonDetailPage.action.ts` does not exist yet.

- [ ] **Step 3: Implement `LessonDetailPage.action.ts`**

```ts
import type { ActionFunctionArgs } from 'react-router'
import {
  completeLessonSession,
  type CompleteLessonSessionDeps,
} from '../../application/complete-lesson-session'
import type { CompleteLessonOutcome } from '../../application/complete-lesson'
import { lessonResultSchema } from '../../domain/korean/lesson-session'

export function createCompleteLessonSessionAction(
  deps: CompleteLessonSessionDeps & { ensureUser: () => Promise<{ uid: string }> },
) {
  return async ({ params, request }: ActionFunctionArgs): Promise<CompleteLessonOutcome> => {
    const lessonId = params.lessonId
    if (!lessonId) {
      throw new Error('Lesson id is required')
    }
    const result = lessonResultSchema.parse(await request.json())
    const user = await deps.ensureUser()
    return completeLessonSession(deps, user.uid, lessonId, result)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/features/lesson/LessonDetailPage.action.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/lesson/LessonDetailPage.action.ts src/features/lesson/LessonDetailPage.action.test.ts
git commit -m "feat(lesson): add the complete-lesson-session route action"
```

---

### Task 7: `VirtualKeyboard.tsx` — presentational keyboard

**Files:**
- Create: `src/features/typing/VirtualKeyboard.tsx`
- Test: `src/features/typing/VirtualKeyboard.test.tsx`

**Interfaces:**
- Consumes: `KEY_TO_JAMO` (`src/domain/korean/keymap.ts`, already exists).
- Produces: `VirtualKeyboard` default export, props `{ nextKey?: { code: string; shift: boolean } }`. Consumed by Task 8.

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import VirtualKeyboard from './VirtualKeyboard'

describe('VirtualKeyboard', () => {
  it('highlights the key matching nextKey.code', () => {
    render(<VirtualKeyboard nextKey={{ code: 'KeyR', shift: false }} />)
    expect(screen.getByText('ㄱ').closest('div')).toHaveClass('bg-amber-100')
  })

  it('highlights Shift when nextKey.shift is true', () => {
    render(<VirtualKeyboard nextKey={{ code: 'KeyQ', shift: true }} />)
    expect(screen.getByText('Shift')).toHaveClass('bg-amber-100')
  })

  it('highlights nothing when nextKey is undefined', () => {
    render(<VirtualKeyboard />)
    expect(screen.getByText('Shift')).not.toHaveClass('bg-amber-100')
    expect(screen.getByText('ㄱ').closest('div')).not.toHaveClass('bg-amber-100')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/features/typing/VirtualKeyboard.test.tsx`
Expected: FAIL — `src/features/typing/VirtualKeyboard.tsx` does not exist yet.

- [ ] **Step 3: Implement `VirtualKeyboard.tsx`**

```tsx
import { KEY_TO_JAMO } from '../../domain/korean/keymap'

const ROW_1 = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP']
const ROW_2 = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL']
const ROW_3 = ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period']
const ROWS = [ROW_1, ROW_2, ROW_3]

function englishLabel(code: string): string {
  if (code === 'Comma') return ','
  if (code === 'Period') return '.'
  return code.replace('Key', '').toLowerCase()
}

interface VirtualKeyboardProps {
  nextKey?: { code: string; shift: boolean }
}

export default function VirtualKeyboard({ nextKey }: VirtualKeyboardProps) {
  return (
    <div className="mt-6 select-none">
      <div
        className={`mb-2 inline-block rounded-md border px-3 py-1 text-sm ${
          nextKey?.shift ? 'border-amber-400 bg-amber-100' : 'border-slate-200 text-slate-400'
        }`}
      >
        Shift
      </div>
      {ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="mb-1 flex gap-1">
          {row.map((code) => {
            const jamo = KEY_TO_JAMO[code]
            const isNext = nextKey?.code === code
            return (
              <div
                key={code}
                className={`flex h-12 w-12 flex-col items-center justify-center rounded-md border text-sm ${
                  isNext ? 'border-amber-400 bg-amber-100' : 'border-slate-200'
                }`}
              >
                <span className="text-base">{jamo.base}</span>
                <span className="text-[10px] text-slate-400">{englishLabel(code)}</span>
              </div>
            )
          })}
        </div>
      ))}
      <div className="mt-1 h-8 w-full rounded-md border border-slate-200" aria-label="Space" />
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/features/typing/VirtualKeyboard.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/typing/VirtualKeyboard.tsx src/features/typing/VirtualKeyboard.test.tsx
git commit -m "feat(typing): add VirtualKeyboard, highlights the next key and Shift"
```

---

### Task 8: `LessonTypingSession.tsx` — the interactive flow

**Files:**
- Create: `src/features/lesson/LessonTypingSession.tsx`
- Test: `src/features/lesson/LessonTypingSession.test.tsx`

**Interfaces:**
- Consumes: `useLessonSessionStore` (Task 5), `getLessonResult`, `getLessonProgress` (Task 2), `getComposedText`, `getCharacterStates` (`src/domain/korean/typing-session.ts`), `KEY_TO_JAMO` (`src/domain/korean/keymap.ts`), `VirtualKeyboard` (Task 7), `CompleteLessonOutcome` (`src/application/complete-lesson.ts`).
- Produces: `LessonTypingSession` default export, props `{ lesson: Lesson; onComplete: (outcome: CompleteLessonOutcome) => void }`. Consumed by Task 9.

- [ ] **Step 1: Write the failing tests**

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import LessonTypingSession from './LessonTypingSession'
import type { Lesson } from '../../domain/models/lesson'
import type { CompleteLessonOutcome } from '../../application/complete-lesson'

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: 'l1',
    unitId: 'u1',
    title: 'Lesson',
    type: 'word',
    order: 1,
    exercises: [
      {
        id: 'e1',
        targetText: '가',
        romanization: null,
        meaningTh: '',
        meaningEn: '',
        difficulty: 'easy',
        hint: null,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

const fakeOutcome: CompleteLessonOutcome = {
  progress: {
    lessonId: 'l1',
    status: 'completed',
    bestAccuracy: 100,
    bestSpeedWpm: 20,
    attempts: 1,
    lastAttemptAt: new Date(),
    completedAt: new Date(),
  },
  expGained: 100,
  level: 2,
  unlockedNextLessonId: null,
}

function renderSession(
  onComplete: (outcome: CompleteLessonOutcome) => void,
  lesson: Lesson = makeLesson(),
  action: () => Promise<CompleteLessonOutcome> = async () => fakeOutcome,
) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        Component: () => <LessonTypingSession lesson={lesson} onComplete={onComplete} />,
        action,
      },
    ],
    { initialEntries: ['/'] },
  )
  return render(<RouterProvider router={router} />)
}

describe('LessonTypingSession', () => {
  it('highlights the current character and updates the composed text on a correct keydown', async () => {
    renderSession(vi.fn())
    await screen.findByText('가')

    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    expect(await screen.findByText('Typed: ㄱ')).toBeInTheDocument()
  })

  it('submits the aggregated result and calls onComplete once the lesson finishes', async () => {
    const onComplete = vi.fn()
    renderSession(onComplete)
    await screen.findByText('가')

    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    fireEvent.keyDown(window, { code: 'KeyK', shiftKey: false })

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce())
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ expGained: 100, level: 2 }))
  })

  it('submits the action exactly once even if extra keydowns fire after completion', async () => {
    const actionSpy = vi.fn(async () => fakeOutcome)
    renderSession(vi.fn(), makeLesson(), actionSpy)
    await screen.findByText('가')

    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    fireEvent.keyDown(window, { code: 'KeyK', shiftKey: false })
    // pressKey already no-ops once the exercise/lesson is complete — these must not cause a second submit
    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    fireEvent.keyDown(window, { code: 'KeyK', shiftKey: false })

    await waitFor(() => expect(actionSpy).toHaveBeenCalledTimes(1))
  })

  it('removes the keydown listener on unmount', async () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderSession(vi.fn())
    await screen.findByText('가')

    unmount()

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
  })

  it('handles a lesson with zero exercises without crashing, submitting immediately', async () => {
    const onComplete = vi.fn()
    renderSession(onComplete, makeLesson({ exercises: [] }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce())
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/features/lesson/LessonTypingSession.test.tsx`
Expected: FAIL — `src/features/lesson/LessonTypingSession.tsx` does not exist yet.

- [ ] **Step 3: Implement `LessonTypingSession.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { useFetcher } from 'react-router'
import { useLessonSessionStore } from '../typing/lesson-session-store'
import { getCharacterStates, getComposedText } from '../../domain/korean/typing-session'
import { getLessonProgress, getLessonResult } from '../../domain/korean/lesson-session'
import { KEY_TO_JAMO } from '../../domain/korean/keymap'
import VirtualKeyboard from '../typing/VirtualKeyboard'
import type { Lesson } from '../../domain/models/lesson'
import type { CompleteLessonOutcome } from '../../application/complete-lesson'

interface LessonTypingSessionProps {
  lesson: Lesson
  onComplete: (outcome: CompleteLessonOutcome) => void
}

export default function LessonTypingSession({ lesson, onComplete }: LessonTypingSessionProps) {
  const { session, start, pressKey } = useLessonSessionStore()
  const fetcher = useFetcher<CompleteLessonOutcome>()
  const hasStarted = useRef(false)
  const hasSubmitted = useRef(false)

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true
    start(lesson.exercises.map((exercise) => ({ id: exercise.id, targetText: exercise.targetText })))
  }, [lesson, start])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (KEY_TO_JAMO[event.code]) {
        event.preventDefault()
      }
      pressKey(event.code, event.shiftKey)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pressKey])

  useEffect(() => {
    if (session?.status === 'completed' && !hasSubmitted.current) {
      hasSubmitted.current = true
      fetcher.submit(getLessonResult(session), { method: 'post', encType: 'application/json' })
    }
  }, [session, fetcher])

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      onComplete(fetcher.data)
    }
  }, [fetcher.state, fetcher.data, onComplete])

  if (!session || session.status === 'completed') {
    return <p className="mt-4 text-sm text-slate-500">Saving…</p>
  }

  const progress = getLessonProgress(session)
  const characters = Array.from(session.currentSession.targetText)
  const characterStates = getCharacterStates(session.currentSession)
  const composed = getComposedText(session.currentSession)
  const nextKey = session.currentSession.expectedKeys[session.currentSession.keyIndex]

  return (
    <div>
      <p className="text-sm text-slate-500">
        {progress.current} / {progress.total}
      </p>

      <div className="mt-4 flex gap-1 text-3xl">
        {characters.map((char, index) => (
          <span
            key={index}
            className={
              characterStates[index] === 'correct'
                ? 'text-emerald-600'
                : characterStates[index] === 'current'
                  ? 'text-slate-900 underline'
                  : 'text-slate-300'
            }
          >
            {char}
          </span>
        ))}
      </div>
      <p className="mt-2 text-sm text-slate-500">Typed: {composed}</p>
      <VirtualKeyboard nextKey={nextKey} />
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/features/lesson/LessonTypingSession.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/lesson/LessonTypingSession.tsx src/features/lesson/LessonTypingSession.test.tsx
git commit -m "feat(lesson): add the interactive LessonTypingSession component"
```

---

### Task 9: Wire it all together — `LessonDetailPage.tsx`, `router.ts`, singletons, manual verification

**Files:**
- Modify: `src/features/lesson/LessonDetailPage.tsx`
- Test: `src/features/lesson/LessonDetailPage.test.tsx` (new)
- Modify: `src/infrastructure/firebase/repositories/index.ts`
- Modify: `src/app/router.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–8.
- Produces: nothing — this is the integration point.

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import LessonDetailPage from './LessonDetailPage'
import type { Lesson } from '../../domain/models/lesson'
import type { CompleteLessonOutcome } from '../../application/complete-lesson'

function makeLesson(): Lesson {
  return {
    id: 'l1',
    unitId: 'u1',
    title: 'Greetings',
    type: 'word',
    order: 1,
    exercises: [
      {
        id: 'e1',
        targetText: '가',
        romanization: null,
        meaningTh: '',
        meaningEn: '',
        difficulty: 'easy',
        hint: null,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

const fakeOutcome: CompleteLessonOutcome = {
  progress: {
    lessonId: 'l1',
    status: 'completed',
    bestAccuracy: 100,
    bestSpeedWpm: 20,
    attempts: 1,
    lastAttemptAt: new Date(),
    completedAt: new Date(),
  },
  expGained: 100,
  level: 2,
  unlockedNextLessonId: 'l2',
}

describe('LessonDetailPage', () => {
  it('shows a Start Lesson button, then switches to the typing session on click', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: LessonDetailPage,
          loader: async () => ({ lesson: makeLesson() }),
          action: async () => fakeOutcome,
        },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Start Lesson' }))

    expect(await screen.findByText('가')).toBeInTheDocument()
  })

  it('shows the inline completion block once the lesson finishes', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: LessonDetailPage,
          loader: async () => ({ lesson: makeLesson() }),
          action: async () => fakeOutcome,
        },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Start Lesson' }))
    await screen.findByText('가')
    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    fireEvent.keyDown(window, { code: 'KeyK', shiftKey: false })

    expect(await screen.findByText('Lesson complete!')).toBeInTheDocument()
    expect(screen.getByText(/\+100 EXP/)).toBeInTheDocument()
    expect(screen.getByText('Next lesson unlocked.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/features/lesson/LessonDetailPage.test.tsx`
Expected: FAIL — no "Start Lesson" button exists yet on the current read-only page.

- [ ] **Step 3: Implement the new `LessonDetailPage.tsx`**

Replace `src/features/lesson/LessonDetailPage.tsx` in full:

```tsx
import { useState } from 'react'
import { useLoaderData } from 'react-router'
import type { LessonDetailLoaderData } from './LessonDetailPage.loader'
import LessonTypingSession from './LessonTypingSession'
import type { CompleteLessonOutcome } from '../../application/complete-lesson'

export default function LessonDetailPage() {
  const { lesson } = useLoaderData() as LessonDetailLoaderData
  const [started, setStarted] = useState(false)
  const [outcome, setOutcome] = useState<CompleteLessonOutcome | null>(null)

  if (outcome) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-medium text-slate-900">Lesson complete!</h1>
        <p className="mt-2 text-slate-700">
          +{outcome.expGained} EXP — now level {outcome.level}
        </p>
        {outcome.unlockedNextLessonId && (
          <p className="mt-1 text-sm text-slate-600">Next lesson unlocked.</p>
        )}
      </main>
    )
  }

  if (started) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-medium text-slate-900">{lesson.title}</h1>
        <LessonTypingSession lesson={lesson} onComplete={setOutcome} />
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-medium text-slate-900">{lesson.title}</h1>
      <p className="mt-1 text-sm text-slate-600">{lesson.type}</p>

      {lesson.exercises.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No exercises yet.</p>
      ) : (
        <>
          <ul className="mt-6 space-y-4">
            {lesson.exercises.map((exercise) => (
              <li key={exercise.id} className="rounded-lg border border-slate-200 p-4">
                <div className="text-xl text-slate-900">{exercise.targetText}</div>
                {exercise.romanization && (
                  <div className="text-sm text-slate-500">{exercise.romanization}</div>
                )}
                <div className="mt-2 text-sm text-slate-700">
                  {exercise.meaningTh} / {exercise.meaningEn}
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setStarted(true)}
            className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-white"
          >
            Start Lesson
          </button>
        </>
      )}
    </main>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/features/lesson/LessonDetailPage.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the 2 new singleton exports**

Replace `src/infrastructure/firebase/repositories/index.ts` in full:

```ts
import { FirebaseCourseRepository } from './firebase-course-repository'
import { FirebaseLessonRepository } from './firebase-lesson-repository'
import { FirebaseProgressRepository } from './firebase-progress-repository'
import { FirebaseUserProfileRepository } from './firebase-user-profile-repository'
import { FirebaseReviewRepository } from './firebase-review-repository'

export const courseRepo = new FirebaseCourseRepository()
export const lessonRepo = new FirebaseLessonRepository()
export const progressRepo = new FirebaseProgressRepository()
export const userProfileRepo = new FirebaseUserProfileRepository()
export const reviewRepo = new FirebaseReviewRepository()
```

- [ ] **Step 6: Wire the action into the router**

Replace `src/app/router.ts` in full:

```ts
import { createBrowserRouter } from 'react-router'
import {
  courseRepo,
  lessonRepo,
  progressRepo,
  userProfileRepo,
  reviewRepo,
} from '../infrastructure/firebase/repositories'
import { signInAnonymouslyIfNeeded } from '../infrastructure/firebase/firebase'
import CourseListPage from '../features/course/CourseListPage'
import { createCourseListLoader } from '../features/course/CourseListPage.loader'
import CourseMapPage from '../features/course/CourseMapPage'
import { createCourseMapLoader } from '../features/course/CourseMapPage.loader'
import LessonDetailPage from '../features/lesson/LessonDetailPage'
import { createLessonDetailLoader } from '../features/lesson/LessonDetailPage.loader'
import { createCompleteLessonSessionAction } from '../features/lesson/LessonDetailPage.action'
import RouteError from './RouteError'
import NotFoundPage from './NotFoundPage'

export const router = createBrowserRouter([
  {
    path: '/',
    Component: CourseListPage,
    loader: createCourseListLoader({
      courseRepo,
      ensureUser: signInAnonymouslyIfNeeded,
    }),
    ErrorBoundary: RouteError,
  },
  {
    path: '/courses/:courseId',
    Component: CourseMapPage,
    loader: createCourseMapLoader({
      courseRepo,
      lessonRepo,
      progressRepo,
      ensureUser: signInAnonymouslyIfNeeded,
    }),
    ErrorBoundary: RouteError,
  },
  {
    path: '/lessons/:lessonId',
    Component: LessonDetailPage,
    loader: createLessonDetailLoader({
      lessonRepo,
      ensureUser: signInAnonymouslyIfNeeded,
    }),
    action: createCompleteLessonSessionAction({
      courseRepo,
      lessonRepo,
      progressRepo,
      userProfileRepo,
      reviewRepo,
      ensureUser: signInAnonymouslyIfNeeded,
    }),
    ErrorBoundary: RouteError,
  },
  {
    path: '*',
    Component: NotFoundPage,
  },
])
```

- [ ] **Step 7: Run the full suite**

Run: `pnpm exec vitest run`
Expected: PASS, every test in the project (this task's + all prior tasks' + everything from earlier rounds).

- [ ] **Step 8: Typecheck, lint, build**

Run: `pnpm exec tsc -b && pnpm lint && pnpm build`
Expected: no errors; `dist/` builds successfully.

- [ ] **Step 9: Manual browser verification**

Run: `pnpm dev`, then in a browser (or via the `claude-in-chrome` tool):

1. Visit `/lessons/greetings-1` (a real seeded lesson — check `docs/PROGRESS.md`/`src/infrastructure/firebase/seed/sample-content.ts` for a valid id if this one has changed).
2. Confirm the read-only exercise list still renders, with a "Start Lesson" button below it.
3. Click "Start Lesson" — confirm the first exercise's target text appears with a virtual keyboard below it, and the next expected key is highlighted (physically press that key on the real keyboard, e.g. `R` for 안녕하세요's first key — confirm the character highlights and the keyboard's highlighted key moves to the next one).
4. Deliberately press a wrong key — confirm nothing advances (no crash, no visible mutation) and the same key stays highlighted.
5. Type through all exercises in the lesson to completion — confirm the "Lesson complete!" block appears with an EXP/level line.
6. Check the browser console for errors (`read_console_messages` if using the browser tool) and the Network tab / Firestore console to confirm a `Progress` write and (if any mistakes were made) a `reviewItems` document were actually created for the signed-in anonymous user.
7. Refresh the page and click "Start Lesson" again on the same lesson — confirm it doesn't crash on a lesson that's already `completed` (per `complete-lesson.ts`'s existing `wasAlreadyCompleted` handling, `expGained` should be `0` the second time).

Fix any issues found before proceeding — this is what actually proves the whole flow works against live Firestore, not just against fakes.

- [ ] **Step 10: Commit**

```bash
git add src/features/lesson/LessonDetailPage.tsx src/features/lesson/LessonDetailPage.test.tsx src/infrastructure/firebase/repositories/index.ts src/app/router.ts
git commit -m "feat(lesson): wire the interactive typing session into LessonDetailPage"
```
