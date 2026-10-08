# Static Keyboard Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the virtual Korean keyboard a clearer static learning guide and expose its existing finger-placement aid in every typing flow.

**Architecture:** Keep typing/session behavior unchanged. `VirtualKeyboard` remains the single source of keyboard presentation and derives static target, Shift, and dimmed styles solely from its existing `nextKey` prop. `FingerPlacementGuide` remains a separate presentation component and is composed into Lesson and Review sessions, as it already is in the two Home players.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, existing Lucide React icons.

**Spec:** User-approved in-chat design, 2026-10-08: static guidance only; no animations, new dependencies, Motion usage, perspective, or correct/wrong feedback.

## Global Constraints

- Do not alter typing-session state, expected-key calculation, persistence, or virtual-key input behavior.
- Do not add Motion, Anime.js, confetti, perspective transforms, timers, or animation classes.
- Use only static visual treatment: target/Shift distinction, non-target de-emphasis, and the existing finger-placement guide.
- Do not add or change automated UI tests; verify visual work manually, then run static checks.
- Do not commit, push, or change dependencies.

## Review Focus

- A shifted target must show both Shift keys in the Shift treatment and its jamo key in the target treatment, without conflating the two meanings.
- An unshifted target must not leave either Shift key highlighted after a prior shifted exercise.
- Keyboard settings (`showEnglishKeys`, `keyboardOpacity`, and hidden keyboard) must retain their current behavior.
- Lesson and Review must receive the same `nextKey` instance for their virtual keyboard and finger guide.
- Home and One-page Home layouts must remain unaffected except for any shared, static finger-guide colour update.

---

### Task 1: Establish static keyboard visual hierarchy

**Files:**
- Modify: `src/features/typing/VirtualKeyboard.tsx`
- Test: no automated test changes (UI-only styling work)

**Interfaces:**
- Consumes: existing `nextKey?: { code: string; shift: boolean }`, `showEnglishKeys`, `opacity`, and `onKeyPress` props.
- Produces: the same public `VirtualKeyboardProps` API; existing callers require no prop changes.

- [x] **Step 1: Define the static key-style precedence in `VirtualKeyboard.tsx`**

Use these mutually exclusive states, in order: target jamo key; required Shift key; normal jamo key; non-jamo key. A target that requires Shift must style the target jamo key as target and both Shift keys as Shift, rather than applying one shared highlight.

- [x] **Step 2: Apply the approved static visual language**

Use a warm cream base for normal keys, a mint/jade target state, a peach Shift-required state, and reduced opacity/contrast for non-target jamo keys while a `nextKey` exists. Keep labels readable and retain the home-row markers. Do not apply transitions, transforms, timers, or animation utilities.

- [x] **Step 3: Remove obsolete commented Shift-indicator markup if the inline Shift key treatment makes it redundant**

Leave no commented-out presentation block that duplicates the delivered interface. The accessible button labels and pressed semantics remain unchanged.

- [x] **Step 4: Manually verify the keyboard in a lesson**

Check an unshifted jamo, a shifted jamo such as `ㅃ`, English-label on/off, keyboard opacity, and touch input. Expected: all behavior remains functional, and only static appearance changes.

- [x] **Step 5: Run static verification**

Run: `pnpm lint && pnpm build`

Expected: both commands exit successfully.

### Task 2: Align finger-guide emphasis with the static target state

**Files:**
- Modify: `src/features/home/FingerPlacementGuide.tsx`
- Test: no automated test changes (UI-only styling work)

**Interfaces:**
- Consumes: existing `nextKey?: { code: string; shift: boolean }` prop and `fingerCodes` mapping.
- Produces: the same `FingerPlacementGuideProps` API with a static active-finger treatment that matches the keyboard target palette.

- [x] **Step 1: Change only the active-finger presentation to the shared mint/jade guidance treatment**

Keep `activeFingerFor` and `fingerCodes` unchanged. Update the active silhouette fill and its status pill so the hand cue visually agrees with the target key; keep inactive hands subdued and static.

- [x] **Step 2: Manually verify left- and right-hand mappings in Home**

Check at least `KeyR` and `KeyK`, plus a shifted key such as `KeyQ`. Expected: exactly the mapped hand/finger is emphasized, while Shift state does not change which jamo finger is indicated.

- [x] **Step 3: Run static verification**

Run: `pnpm lint && pnpm build`

Expected: both commands exit successfully.

### Task 3: Surface the existing finger guide in Lesson and Review

**Files:**
- Modify: `src/features/lesson/LessonTypingSession.tsx`
- Modify: `src/features/review/ReviewTypingSession.tsx`
- Test: no automated test changes (UI-only composition work)

**Interfaces:**
- Consumes: `FingerPlacementGuide` from `src/features/home/FingerPlacementGuide.tsx` and each session's existing `nextKey` value.
- Produces: identical keyboard/finger guidance in Lesson, Review, Home, and One-page Home flows without changing the session APIs.

- [x] **Step 1: Import and render `FingerPlacementGuide` beneath `VirtualKeyboard` in `LessonTypingSession.tsx`**

Pass the existing `nextKey` variable to both components. Render only inside the existing `keyboardSettings.showKeyboard` condition so a user who hides the keyboard also hides its paired guide.

- [x] **Step 2: Import and render `FingerPlacementGuide` beneath `VirtualKeyboard` in `ReviewTypingSession.tsx`**

Match the Lesson composition and use the existing `nextKey`; do not duplicate or recalculate expected-key logic.

- [x] **Step 3: Manually verify the active typing contexts**

Verified Home, Lesson, and Review on the active desktop deployment. The One-page Home fallback is not mounted while Home content is available; it remains structurally unchanged apart from the shared static finger-guide colour. Expected: Lesson/Review now show the guide and Home remains stable.

- [x] **Step 4: Run final static verification**

Run: `pnpm lint && pnpm build`

Expected: both commands exit successfully.

## Handoff

Suggested commit message after implementation, if requested: `feat(typing): add static keyboard and finger guidance`
