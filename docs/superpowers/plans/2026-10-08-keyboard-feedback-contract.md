# Keyboard Feedback Contract Implementation Plan

**Goal:** Emit one transient correct/wrong keyboard-feedback event for every typing attempt while an active keyboard is present, regardless of whether it originated from hardware input or the virtual keyboard.

**Architecture:** A pure typing-presentation helper will compare an attempted physical key against the current `ExpectedKey` using the same `strictShift` rule as the typing engine. A lightweight React hook owns only the event sequence and latest event; each typing host reads its current session immediately before dispatching `pressKey`, records feedback, and passes it to `VirtualKeyboard`. No domain session, persistence model, reducer output, or visual treatment changes.

**Tech Stack:** React 19, TypeScript, Vitest.

## Constraints

- Feedback is transient client UI state; never persist it or add it to typing-session/domain state.
- Match `typing-session.ts` semantics: only `strictShift` expected keys require an exact Shift match.
- Ignore an attempt when no current expected key exists.
- Add tests only for the pure correctness mapper; do not add animation or presentation assertions.
- Feedback timing and static colour treatment were added later: correct attempts show soft blue briefly, then lavender and fade; wrong attempts show coral briefly and fade. Motion-library effects remain deferred.
- Final-key feedback presentation is deferred: Lesson/Review replace the keyboard with Saving immediately, so the later animation scope must decide whether completion waits briefly or feedback moves to the completion UI.

### Task 1: Add a tested feedback mapper and hook

**Files:**

- Create: `src/features/typing/keyboard-feedback.ts`
- Create: `src/features/typing/keyboard-feedback.test.ts`

- [x] Write failing tests for correct code/Shift, incorrect code, incorrect required Shift, held Shift on a non-strict key, and missing expected key.
- [x] Implement `createKeyboardFeedback(expectedKey, code, shiftKey, id)` and `useKeyboardFeedback()`.
- [x] Run `pnpm test src/features/typing/keyboard-feedback.test.ts`.

### Task 2: Wire feedback through all typing input paths

**Files:**

- Modify: `src/features/typing/VirtualKeyboard.tsx`
- Modify: `src/features/lesson/LessonTypingSession.tsx`
- Modify: `src/features/review/ReviewTypingSession.tsx`
- Modify: `src/features/home/HomePlayer.tsx`
- Modify: `src/features/home/OnePageLearningPlayer.tsx`

- [x] Extend `VirtualKeyboard` with an optional `feedback` prop but leave presentation unchanged.
- [x] In each host's shared input handler, read the current session before calling `pressKey`, call `recordAttempt`, and pass feedback to the virtual keyboard.
- [x] Confirm physical and touch input use that same shared handler in every host.
- [x] Run focused mapper tests, `pnpm lint`, and `pnpm build`.

**Review ruling:** Hosts record the final key event before their session completes, but Lesson, Review, and exhausted One-page sessions unmount the keyboard in the same render. This task intentionally introduces no completion delay or animation; the final-key visual treatment belongs to the later Motion scope.

### Task 3: Record status

**Files:**

- Modify: `docs/PROGRESS.md`
- Modify: this plan

- [x] Document the feedback contract as preparation for deferred animation work; mark completed plan tasks.
