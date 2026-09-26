# Keyboard Settings and Review Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply keyboard preferences in lesson and review typing sessions, and
show preference-aware vocabulary context in Review previews.

**Architecture:** `VirtualKeyboard` owns only keyboard presentation. The two
typing-session components decide whether to mount it and pass their
route-loaded settings through. A new application read model joins due review
items to their source exercises through `LessonRepository`; `ReviewPage.loader`
returns that result and settings to the UI.

**Tech Stack:** React 19, TypeScript, React Router loaders, Vitest, React
Testing Library, Zod, Tailwind CSS 4.

**Spec:** `docs/superpowers/specs/2026-09-27-keyboard-settings-review-preview-design.md`

## Global Constraints

- No React component may access Firebase directly; loaders call application
  functions and application functions use domain repositories.
- Keep persisted settings in route-loader data, never Zustand.
- Keep Korean target text visible when source lesson/exercise metadata is
  unavailable; omit only the unavailable metadata.
- Existing user settings must not be migrated or overwritten; only new default
  profiles receive `keyboardOpacity: 0.7`.
- Do not implement sound, dark mode, active-session vocabulary hints, or review
  scheduling changes.
- Do not create a Git commit unless the user explicitly asks.

## Review Focus

- A saved opacity of `0` must render a fully transparent keyboard without
  treating it as an absent value (Task 1).
- Both lesson and review sessions must honor `showKeyboard: false`, not just
  the lesson flow (Task 2).
- Multiple due items from one lesson must perform one lesson lookup, while
  different lessons are fetched independently (Task 3).
- A deleted lesson or deleted exercise must retain its Korean-only review row,
  rather than dropping it or failing the route (Tasks 3–4).
- Turning off romanization and selecting one meaning language must affect only
  Review preview metadata, never the target text or active typing session
  (Task 4).

---

### Task 1: Keyboard presentation settings and default profile

**Files:**

- Modify: `src/domain/models/user-profile.ts`
- Modify: `src/domain/models/user-profile.test.ts`
- Modify: `src/features/typing/VirtualKeyboard.tsx`
- Modify: `src/features/typing/VirtualKeyboard.test.tsx`

**Interfaces:**

- Produces: `VirtualKeyboardProps` accepts `nextKey`, `showEnglishKeys`, and
  `opacity`; callers can hide English labels and set any schema-valid opacity.
- Produces: `defaultUserProfile(userId, now)` returns settings with
  `keyboardOpacity: 0.7`.

- [ ] **Step 1: Write failing domain and component tests**

  Change the expected default profile opacity from `1` to `0.7`. Add
  `VirtualKeyboard` tests proving `showEnglishKeys={false}` omits an English
  label and `opacity={0}` sets the keyboard container opacity to zero.

- [ ] **Step 2: Run the focused tests and verify RED**

  Run: `pnpm exec vitest run src/domain/models/user-profile.test.ts src/features/typing/VirtualKeyboard.test.tsx`

  Expected: FAIL because the default is still `1` and the keyboard does not
  accept or apply the presentation props.

- [ ] **Step 3: Implement the minimal presentation contract**

  Change `defaultUserProfile` to set `keyboardOpacity: 0.7`. Extend
  `VirtualKeyboardProps` with required `showEnglishKeys: boolean` and
  `opacity: number`; apply opacity to its outer element and render the English
  label only when enabled. Update existing direct test renders to provide the
  props.

- [ ] **Step 4: Run the focused tests and verify GREEN**

  Run: `pnpm exec vitest run src/domain/models/user-profile.test.ts src/features/typing/VirtualKeyboard.test.tsx`

  Expected: PASS.

### Task 2: Route settings reach both typing-session consumers

**Files:**

- Modify: `src/features/lesson/LessonDetailPage.tsx`
- Modify: `src/features/lesson/LessonDetailPage.test.tsx`
- Modify: `src/features/lesson/LessonTypingSession.tsx`
- Modify: `src/features/lesson/LessonTypingSession.test.tsx`
- Modify: `src/features/review/ReviewTypingSession.tsx`
- Modify: `src/features/review/ReviewTypingSession.test.tsx`

**Interfaces:**

- Consumes: Task 1 `VirtualKeyboard` presentation props.
- Produces: both typing-session components accept a `Pick<UserSettings,
  'showKeyboard' | 'showEnglishKeys' | 'keyboardOpacity'>` keyboard-settings
  prop and use it to control the guide.

- [ ] **Step 1: Write failing session and page tests**

  Extend lesson and review typing-session render helpers to supply keyboard
  settings. Add one test per session that `showKeyboard: false` omits the
  keyboard, and one test that a visible guide honors hidden English labels and
  `keyboardOpacity: 0`. Add a Lesson detail test that starting a lesson passes
  its loader settings into the typing session.

- [ ] **Step 2: Run the focused tests and verify RED**

  Run: `pnpm exec vitest run src/features/lesson/LessonDetailPage.test.tsx src/features/lesson/LessonTypingSession.test.tsx src/features/review/ReviewTypingSession.test.tsx`

  Expected: FAIL because the components do not yet accept settings or mount
  the guide conditionally.

- [ ] **Step 3: Implement settings propagation**

  Add the typed keyboard-settings prop to both session components. Conditionally
  render `VirtualKeyboard` with `showKeyboard`, and pass the remaining props.
  Pass the Lesson detail loader's settings to `LessonTypingSession` when the
  lesson starts. Preserve all keyboard event and session-submission behavior.

- [ ] **Step 4: Run the focused tests and verify GREEN**

  Run: `pnpm exec vitest run src/features/lesson/LessonDetailPage.test.tsx src/features/lesson/LessonTypingSession.test.tsx src/features/review/ReviewTypingSession.test.tsx`

  Expected: PASS.

### Task 3: Review preview application read model and loader data

**Files:**

- Create: `src/application/get-review-previews.ts`
- Create: `src/application/get-review-previews.test.ts`
- Modify: `src/features/review/ReviewPage.loader.ts`
- Modify: `src/features/review/ReviewPage.loader.test.ts`
- Modify: `src/app/router.ts`

**Interfaces:**

- Produces: `getReviewPreviews(lessonRepo: LessonRepository, items:
  ReviewItem[]): Promise<ReviewPreview[]>`, where each `ReviewPreview` has
  `item: ReviewItem` and `exercise: LessonExercise | null`.
- Consumes: `LessonRepository.getLessonById`, `getDueReviewItems`, and
  `getSettings`.
- Produces: `ReviewLoaderData` with `previews: ReviewPreview[]` and
  `settings: UserSettings`.

- [ ] **Step 1: Write failing application tests**

  Add tests for an item joined to its matching exercise, duplicate
  `sourceLessonId`s queried once, and missing lesson or exercise producing an
  entry with `exercise: null` while retaining its original item.

- [ ] **Step 2: Run the application test and verify RED**

  Run: `pnpm exec vitest run src/application/get-review-previews.test.ts`

  Expected: FAIL because the module and exported function do not exist.

- [ ] **Step 3: Implement `getReviewPreviews`**

  Deduplicate source lesson ids, fetch the distinct lessons concurrently, map
  each item to the exercise whose id equals `sourceExerciseId`, and return
  `null` when no matching source can be found. Do not mutate or filter input
  review items.

- [ ] **Step 4: Run the application test and verify GREEN**

  Run: `pnpm exec vitest run src/application/get-review-previews.test.ts`

  Expected: PASS.

- [ ] **Step 5: Write failing loader tests**

  Update the loader test setup with fake lesson and user-profile repositories.
  Assert the loader returns saved/default settings plus joined previews and
  preserves a missing-source preview.

- [ ] **Step 6: Run the loader test and verify RED**

  Run: `pnpm exec vitest run src/features/review/ReviewPage.loader.test.ts`

  Expected: FAIL because the loader returns raw `items` only and lacks the
  required dependencies.

- [ ] **Step 7: Implement loader and router wiring**

  Have the loader authenticate first, fetch due items and settings concurrently,
  then call `getReviewPreviews`. Add `lessonRepo` and `userProfileRepo` to its
  dependencies and supply them from the router. Return only `previews` and
  `settings`; active typing later derives its `ReviewItem[]` from previews.

- [ ] **Step 8: Run the loader test and verify GREEN**

  Run: `pnpm exec vitest run src/features/review/ReviewPage.loader.test.ts`

  Expected: PASS.

### Task 4: Preference-aware Review preview, verification, and documentation

**Files:**

- Modify: `src/features/review/ReviewPage.tsx`
- Modify: `src/features/review/ReviewPage.test.tsx`
- Modify: `docs/PROGRESS.md`
- Modify: `docs/COMPLETE-LOG.md`

**Interfaces:**

- Consumes: Task 3 `ReviewLoaderData.previews` and `settings`.
- Consumes: Task 2 `ReviewTypingSession` keyboard-settings prop.
- Consumes: existing `formatExerciseMeaning` for optional exercise metadata.

- [ ] **Step 1: Write failing Review page tests**

  Replace raw loader items with previews/settings. Assert the preview renders
  Korean plus romanization and Thai/English meaning when enabled, omits
  romanization and excluded meaning language when disabled/selected, and
  renders Korean only when `exercise` is null. Assert starting the review
  passes raw `ReviewItem`s and the keyboard settings to the session.

- [ ] **Step 2: Run the Review page test and verify RED**

  Run: `pnpm exec vitest run src/features/review/ReviewPage.test.tsx`

  Expected: FAIL because the page consumes `items`, renders no metadata, and
  does not pass settings to its typing session.

- [ ] **Step 3: Implement the Review page adaptation**

  Render each preview's `item.targetText`. When `exercise` exists, use
  `romanizationEnabled` and `formatExerciseMeaning` exactly as Lesson detail
  does. Derive the session's `ReviewItem[]` from `previews` and pass the three
  keyboard settings into `ReviewTypingSession`. Do not render vocabulary
  metadata in the active session.

- [ ] **Step 4: Run the Review page test and verify GREEN**

  Run: `pnpm exec vitest run src/features/review/ReviewPage.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Update delivery documentation**

  Update `docs/PROGRESS.md` so Settings notes identify all five active
  consumers (`meaningLanguage`, `romanizationEnabled`, `showKeyboard`,
  `showEnglishKeys`, `keyboardOpacity`) and state that sound/theme remain
  persist-only. Add a dated entry to `docs/COMPLETE-LOG.md` describing the
  keyboard wiring, default opacity, and Review preview join/fallback.

- [ ] **Step 6: Run complete verification**

  Run: `pnpm test && tsc -b && pnpm lint`

  Expected: all tests, TypeScript compilation, and lint pass.
