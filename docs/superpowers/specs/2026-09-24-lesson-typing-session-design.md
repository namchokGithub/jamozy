# Lesson Typing Session — Design

**Date:** 2026-09-24
**Status:** Approved, not yet implemented

## Goal

Wire the already-built Korean typing engine (`src/domain/korean/*`, `src/features/typing/session-store.ts`) into an interactive "Start Lesson" flow on `LessonDetailPage`: sequence through a lesson's exercises, show a virtual keyboard highlighting the next key, and persist the result (`Progress`/`UserProfile`/EXP via `complete-lesson`, plus `ReviewItem`s for mistakes) through a React Router action.

## Scope

**In scope, this round:**

- Lesson-exercise sequencing (auto-advance between exercises, per prior decision) and lesson-level result aggregation, built as pure domain logic (`lesson-session.ts`), same discipline as the engine itself.
- Richer mistake capture in the engine itself (`typing-session.ts` amended: `mistakeCount: number` → `mistakes: MistakeEvent[]`), so the session has enough detail for a future weak-key feature, even though only a coarse summary is persisted this round.
- A new `ReviewRepository.getReviewItem` point lookup (deterministic ID, no collection scan) and `application/create-review-items.ts` use case.
- A new `application/complete-lesson-session.ts` orchestrating use case (`complete-lesson` + `create-review-items`).
- A React Router `action` (not a loader-returned closure) on `/lessons/:lessonId`, invoked via `useFetcher`, as the only mutation path.
- `VirtualKeyboard.tsx` (presentational, highlights next key + Shift) and `LessonTypingSession.tsx` (owns the interactive flow + keydown listener).
- An inline completion block on `LessonDetailPage` (EXP gained, new level, whether the next lesson unlocked) — no dedicated Lesson Result screen.

**Explicitly out of scope (deferred):**

- A full Lesson Result screen with Retry/Review-Mistakes buttons (no Review UI exists to link to yet).
- Persisting per-jamo mistake detail (`MistakeEvent[]`) to Firestore — `ReviewItem` keeps its existing coarse shape (`mistakeCount`, `lastMistakeAt`) this round; the richer in-session detail is captured for a future feature, not written anywhere yet.
- Any "weak keys" analytics UI.
- Settings-driven keyboard show/hide, opacity, or English-key toggle — `VirtualKeyboard` is always shown this round (no Settings UI exists yet to wire a toggle to).

## Flow

```
LessonDetail route loader
       ↓
Load Lesson
       ↓
LessonDetailPage
       ↓
Start Lesson (local "idle" state, not started yet)
       ↓
LessonTypingSession  (owns keydown listener)
       ↓
lesson-session-store  (Zustand, thin wrapper)
       ↓
lesson-session.ts  (pure: sequencing + aggregation)
       ↓
typing-session.ts  (pure: jamo-level matching, already built)
       ↓
Exercise auto-advances when typing-session.ts reports 'completed'
       ↓
Lesson session status: 'completed' (lesson-session.ts)
       ↓
React Router action, via useFetcher (the only mutation path — not a loader closure)
       ↓
completeLessonSession (application/complete-lesson-session.ts)
       ├── completeLesson (application/complete-lesson.ts, already built)
       │      └── Progress / EXP / Unlock
       │
       └── createReviewItemsFromMistakes (application/create-review-items.ts)
              └── ReviewRepository (point lookup by deterministic id, no scan)
       ↓
CompleteLessonOutcome (fetcher.data)
       ↓
Inline Result (LessonDetailPage)
```

## Amending `typing-session.ts` (richer mistake capture)

Still uncommitted from the previous round, safe to change directly (no migration needed).

```ts
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
  mistakes: MistakeEvent[] // was: mistakeCount: number
  status: 'in-progress' | 'completed'
}
```

`pressKey`'s wrong-key branch now appends a `MistakeEvent` instead of incrementing a counter:

```ts
return {
  ...state,
  mistakes: [
    ...state.mistakes,
    {
      syllableIndex: expected.syllableIndex,
      expectedCode: expected.code,
      expectedShift: expected.shift,
      expectedJamo: expected.jamo,
      pressedCode: code,
      pressedShift: shiftKey,
    },
  ],
}
```

`getAccuracy` reads `state.mistakes.length` instead of `state.mistakeCount`. `startTypingSession` initializes `mistakes: []`. Every existing test in `typing-session.test.ts` that asserted `.mistakeCount` needs updating to assert on `.mistakes` (length and/or content) instead — no behavior change to matching/blocking, purely a richer record of what happened.

## `lesson-session.ts` (new, pure)

```ts
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
  startedAt: Date // for durationSeconds — Date, matching every other `now`/timestamp in this codebase (complete-lesson.ts, progress-repository, etc.), not a raw number
  status: 'typing' | 'completed'
}

export function startLessonSession(
  exercises: Array<Pick<LessonExercise, 'id' | 'targetText'>>,
  now: Date = new Date(),
): LessonSessionState

export function pressKey(state: LessonSessionState, code: string, shiftKey: boolean): LessonSessionState

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

export function getLessonResult(state: LessonSessionState, now: Date = new Date()): LessonResult
export function getLessonProgress(state: LessonSessionState): { current: number; total: number }

export const lessonResultSchema: z.ZodType<LessonResult>
```

`lessonResultSchema` (Zod — a listed dependency in this project's own tech stack, `README.md`'s "Validation: Zod", not yet used anywhere in the codebase) validates `{accuracy: number between 0 and 100, speedWpm: number >= 0, durationSeconds: number >= 0, mistakes: array of {sourceExerciseId: string, targetText: string}}` — 0–100, matching `getLessonResult`'s scale (see above), not the engine's internal 0–1. This is the first spot in the app where a payload crosses a real serialization boundary (`fetcher.submit` → `request.json()`), so validating it here rather than trusting a raw cast is the correct, and first real, use of the project's own chosen validation library.

**`startLessonSession`**: `status: 'completed'` immediately if `exercises` is empty (mirrors `startTypingSession`'s empty-target handling), else `'typing'` with `currentSession = startTypingSession(exercises[0].targetText)`.

**`pressKey`**: no-ops if `state.status === 'completed'`. Otherwise delegates to `typing-session.ts`'s `pressKey` on `currentSession`. If the result's `status` is still `'in-progress'`, just update `currentSession`. If it became `'completed'`: record `{exerciseId, targetText, correctKeyCount: keyIndex, mistakes}` from the just-finished exercise into `completedResults`; if `currentIndex + 1 < exercises.length`, advance to the next exercise (`startTypingSession` on it); otherwise set `status: 'completed'` on the whole lesson session (auto-advance, per the earlier decision — no pause between exercises).

**`getLessonResult`**: `totalCorrectKeystrokes = sum(correctKeyCount)`, `totalMistakes = sum(mistakes.length)` across `completedResults`. **`accuracy = totalCorrectKeystrokes + totalMistakes === 0 ? 0 : (totalCorrectKeystrokes / (totalCorrectKeystrokes + totalMistakes)) * 100`** — **0–100 scale, not the 0–1 fraction `typing-session.ts`'s own `getAccuracy()` uses.** This is a deliberate unit conversion at this boundary: every consumer downstream (`complete-lesson.ts`'s `calculateExpGained`, which checks `accuracy > 90`/`accuracy === 100`; `Progress.bestAccuracy`; `UserStats.averageAccuracy`) is documented in `docs/DOMAIN-MODEL.md` and implemented as 0–100. `typing-session.ts`'s 0–1 `getAccuracy()` stays as-is (unrelated internal/display concern) — only `lesson-session.ts` converts, at the one place a lesson-level number crosses into the rest of the app. `durationSeconds = (now.getTime() - startedAt.getTime()) / 1000`. **`speedWpm = durationSeconds === 0 ? 0 : (totalCorrectKeystrokes / 5) / (durationSeconds / 60)`** (physical-keystroke WPM, zero-guarded — this measures keyboard typing skill, which is what's being taught; a Hangul syllable is not one keystroke, so keystroke count is the correct unit, not displayed-character count). `mistakes`: one `{sourceExerciseId, targetText}` entry per `completedResults` item where `mistakes.length > 0` — this is deliberately the coarse shape `create-review-items.ts` needs; the full per-jamo `MistakeEvent[]` stays in `completedResults` (in-memory, not persisted this round) for a future weak-key feature.

**`getLessonProgress`**: `{ current: completedResults.length, total: exercises.length }`.

## `ReviewRepository` addition

```ts
export interface ReviewRepository {
  getReviewItems(userId: string): Promise<ReviewItem[]>
  getReviewItem(userId: string, itemId: string): Promise<ReviewItem | null> // new
  addReviewItem(userId: string, item: ReviewItem): Promise<void>
  updateReviewItem(userId: string, item: ReviewItem): Promise<void>
}
```

`FirebaseReviewRepository.getReviewItem` is a point `getDoc(doc(db, 'users', userId, 'reviewItems', itemId))` lookup — same shape as `FirebaseProgressRepository.getProgress`. `FakeReviewRepository.getReviewItem` looks up its internal map directly. This exists specifically so `create-review-items.ts` never has to scan the whole collection to find an existing item — the id is deterministic (`LessonExercise.id`, already documented in `docs/DOMAIN-MODEL.md` as "stable ID within the lesson, for review linking").

## `application/create-review-items.ts` (new)

```ts
export async function createReviewItemsFromMistakes(
  reviewRepo: ReviewRepository,
  userId: string,
  lessonId: string,
  mistakes: MistakeReport[],
  now: Date = new Date(),
): Promise<void>
```

For each mistake: `getReviewItem(userId, mistake.sourceExerciseId)` (point lookup, deterministic id — never `getReviewItems()` + scan). If found: `updateReviewItem` with `mistakeCount: existing.mistakeCount + 1`, `lastMistakeAt: now`, `resolved: false`, `box: 1`, `nextReviewAt: nextReviewDate(1, now)` — a fresh mistake always resets spaced-repetition progress to box 1, per `DEC-008`, rather than silently discarding it by blind-overwriting. If not found: `addReviewItem` with a fresh item (`id: mistake.sourceExerciseId`, `sourceLessonId: lessonId`, `sourceExerciseId`, `targetText`, `reason: 'mistake'`, `mistakeCount: 1`, `lastMistakeAt: now`, `resolved: false`, `box: 1`, `nextReviewAt: nextReviewDate(1, now)`). No-ops if `mistakes` is empty (no extra reads).

## `application/complete-lesson-session.ts` (new)

```ts
export interface CompleteLessonSessionDeps extends CompleteLessonDeps {
  reviewRepo: ReviewRepository
}

export async function completeLessonSession(
  deps: CompleteLessonSessionDeps,
  userId: string,
  lessonId: string,
  result: LessonResult, // structurally satisfies LessonCompletionResult (accuracy/speedWpm/durationSeconds) — completeLesson ignores the extra `mistakes` field
  now: Date = new Date(),
): Promise<CompleteLessonOutcome>
```

Calls `completeLesson(deps, userId, lessonId, result, now)`, then `createReviewItemsFromMistakes(deps.reviewRepo, userId, lessonId, result.mistakes, now)`, and returns `completeLesson`'s outcome (review-item creation is a side effect, doesn't change the returned shape).

## Router wiring — action, not a loader closure

`LessonDetailPage.loader.ts` stays a pure read (only change: nothing — it's untouched by this plan). A new sibling file:

```ts
// LessonDetailPage.action.ts
export function createCompleteLessonSessionAction(
  deps: CompleteLessonSessionDeps & { ensureUser: () => Promise<{ uid: string }> },
) {
  return async ({ params, request }: ActionFunctionArgs): Promise<CompleteLessonOutcome> => {
    const lessonId = params.lessonId
    if (!lessonId) throw new Error('Lesson id is required')
    const result = lessonResultSchema.parse(await request.json())
    const user = await deps.ensureUser()
    return completeLessonSession(deps, user.uid, lessonId, result)
  }
}
```

`src/app/router.ts` adds `action: createCompleteLessonSessionAction({ courseRepo, lessonRepo, progressRepo, userProfileRepo, reviewRepo, ensureUser: signInAnonymouslyIfNeeded })` on the `/lessons/:lessonId` route, alongside its existing `loader`. `infrastructure/firebase/repositories/index.ts` gains 2 more singleton exports: `userProfileRepo`, `reviewRepo` (classes already exist, weren't exported as singletons yet). Still only `router.ts` touches Firebase directly — no new import of `infrastructure/firebase` anywhere in `features/`.

Component side calls the action via `useFetcher<CompleteLessonOutcome>()`: `fetcher.submit(lessonResult, { method: 'post', encType: 'application/json' })`, and reads `fetcher.state`/`fetcher.data` for progress/result — no manual promise-juggling in the component.

## UI components

**`LessonDetailPage.tsx`** (modified): keeps its existing read-only exercise list + adds a "Start Lesson" button. Local `useState` tracks whether the learner has started (the `idle` phase — external to any store, since nothing needs to persist "not started yet"). Once started, renders `<LessonTypingSession lesson={lesson} onComplete={setCompletionOutcome} />` in place of the read-only list. Once `completionOutcome` is set, renders the inline result block (`expGained` EXP, `level`, and — if `unlockedNextLessonId` — a note that the next lesson unlocked) instead of the typing UI.

**`LessonTypingSession.tsx`** (new, `features/lesson/`): owns `lesson-session-store` and a `fetcher = useFetcher<CompleteLessonOutcome>()`. A `window.addEventListener('keydown', ...)` effect: ignores events with `metaKey`/`ctrlKey`/`altKey` held (so browser shortcuts keep working), otherwise forwards `event.code`/`event.shiftKey` to the store's `pressKey` and calls `event.preventDefault()` only when `KEY_TO_JAMO[event.code]` exists (a key the engine actually recognizes) or it's `Comma`/`Period`/`Space`. Renders the current exercise's target text using `getCharacterStates`/`getComposedText` from `typing-session.ts` (against `state.currentSession`) for correct/current/pending highlighting, `getLessonProgress` as "X / Y", and `<VirtualKeyboard nextKey={state.currentSession.expectedKeys[state.currentSession.keyIndex]} />`. A `useEffect` watching `state.status`: the first time it becomes `'completed'` (guarded so it only fires once, e.g. via a `useRef`), calls `fetcher.submit(getLessonResult(state), {...})`. Calls `onComplete(fetcher.data)` once `fetcher.state === 'idle' && fetcher.data` (the `submitted` phase).

**`VirtualKeyboard.tsx`** (new, `features/typing/`): presentational, `{ nextKey?: { code: string; shift: boolean } }` prop. Renders 3 static rows matching the physical QWERTY layout (`KeyQ..KeyP`, `KeyA..KeyL`, `KeyZ..KeyM` + `Comma`/`Period`) plus a `Space` bar, using `KEY_TO_JAMO[code]` for each key's primary (jamo) label and a derived English-letter secondary label (from the `code` string itself, e.g. `KeyR` → `r`). Highlights the key matching `nextKey.code`; also highlights a static on-screen Shift indicator when `nextKey.shift` is true. Renders nothing highlighted if `nextKey` is `undefined` (lesson already completed).

## Completion lifecycle

Five conceptual phases, deliberately spread across the layer that actually owns each one rather than duplicated into one flat state machine:

| Phase | Owned by |
|---|---|
| `idle` | `LessonDetailPage`'s local "started?" `useState` |
| `typing` | `lesson-session.ts` / `lesson-session-store`'s `status: 'typing'` |
| `completed` | `lesson-session.ts` / `lesson-session-store`'s `status: 'completed'` (typing done, not yet submitted) |
| `submitting` | `fetcher.state === 'submitting'` (React Router's own fetcher state) |
| `submitted` | `fetcher.state === 'idle' && fetcher.data !== undefined` |

`LessonTypingSession` derives one combined value from these for rendering, rather than the pure `lesson-session.ts` trying to model the async submission itself — that's already React Router's job, not duplicated.

## Testing

- `typing-session.test.ts`: update existing `.mistakeCount` assertions to `.mistakes` (length/content); no new behavior, just the richer record.
- `lesson-session.ts`: unit tests (pure, no Zustand/React) — sequencing through 2+ exercises with auto-advance, `getLessonResult`'s accuracy/WPM math (including the keystroke-based WPM, not character-based, **and the 0–100 accuracy scale, not the engine's internal 0–1**), `getLessonProgress`, empty-exercises edge case, `lessonResultSchema` accepts a valid result and rejects a malformed one (e.g. `accuracy` out of range).
- `create-review-items.ts`: unit tests against `FakeReviewRepository` — creates a fresh item when none exists, updates (increments `mistakeCount`, resets `box` to 1) when one already exists, no-ops for an empty mistakes list, no `getReviewItems()` call at all (only `getReviewItem` point lookups).
- `complete-lesson-session.ts`: unit test confirming it calls both `completeLesson` and `createReviewItemsFromMistakes` and returns the former's outcome.
- `LessonDetailPage.action.ts`: unit test (factory pattern, same as loaders) — parses the JSON body, resolves the user, calls `completeLessonSession`, missing `lessonId` throws.
- `VirtualKeyboard.tsx` / `LessonTypingSession.tsx`: light RTL coverage — a keydown updates the highlighted character/key; reaching lesson completion triggers the fetcher submission and eventually renders via `onComplete`. Not exhaustive UI coverage, matching the depth of the course/lesson UI round.

## Follow-on work (not this round)

- Full Lesson Result screen (Retry / Review Mistakes) once Review UI exists.
- Persisting `MistakeEvent[]` detail (or an aggregate "weak keys" summary) to Firestore, and a UI surfacing it.
- Settings-driven keyboard show/hide, opacity, English-key-label toggle.
- `/units/:unitId` route, if units need standalone content later (carried over from the earlier UI round, still not needed).
