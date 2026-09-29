# Light Theme UI Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every existing Jamozy interface feel cohesive with Home's warm, calm light theme while adding shared modal, dropdown, and snackbar patterns.

**Architecture:** Presentation-only primitives in `src/components/ui/` own reusable appearance and accessibility. Route pages retain their existing loader/fetcher/local-state ownership and compose those primitives. `SnackbarProvider` wraps `RouterProvider`; Settings' action is the sole controlled outcome change, converting persistence failures to a UI-readable error result without changing validation or write semantics.

**Tech Stack:** React 19, TypeScript 5, React Router 8, Tailwind CSS 4, Lucide React, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-29-light-theme-ui-design.md`

## Global Constraints

- Implement the Home light visual language only: cream canvas; blush, sage, lilac, and butter accents; ink-navy text; terracotta actions; soft warm borders/shadows; generous rounded corners.
- Do not add animation, dependencies, dark-mode CSS, assets, data models, repositories, Firebase access, loader changes, or learning/review/auth/session behaviour changes.
- Use only existing public Jamozy logo/icon assets and the existing mascot asset; decorative images must have empty `alt` text.
- Keep persistence access out of components and retain all existing routes, fetcher submits, labels, and keyboard mapping behaviour.
- Settings may change only its failed action outcome into `{ error: string }`; validation, `ensureUser`, `updateSettings`, and successful `UserSettings` result remain unchanged.
- Snackbar triggers are limited to Settings save, auth sign-in/sign-up/Google outcomes, and Home sign-out outcomes. Do not notify for lesson or review completion.
- Preserve native semantic controls where appropriate: labelled checkboxes, range input, form fields, links, and keyboard interaction.
- Never create a Git commit unless the user explicitly asks.

## Review Focus

1. **Settings save revalidation:** a save resolves before the route loader revalidates; success notification must wait for the existing `submitting → loading → idle` lifecycle. Pinned in Task 3.
2. **Settings persistence failure:** an adapter/network failure must show a snackbar and leave unsaved settings editable, not replace the page with a route error. Pinned in Task 3.
3. **Auth error and close:** failed authentication keeps the modal/form open and announces its existing error; successful authentication announces once then closes. Pinned in Task 4.
4. **Sparse content:** empty courses, units, exercises, and review queues retain a friendly visible state rather than a blank themed surface. Pinned in Tasks 5 and 6.
5. **Keyboard usability:** next-key and Shift highlighting, opacity, and English-label settings remain functionally identical after the theme update. Pinned in Task 6.

---

### Task 1: Shared light-theme primitives

**Files:**
- Create: `src/components/ui/PageSurface.tsx`
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Modal.tsx`
- Create: `src/components/ui/Dropdown.tsx`
- Create: `src/components/ui/ui.test.tsx`

**Interfaces:**
- Produces `PageSurface`, `Card`, `Button`, `Modal`, and `Dropdown`, each presentation-only and composable by later page tasks.
- `Modal` consumes `open`, `title`, `onClose`, and `children`; it renders an accessible labelled dialog only when open.
- `Dropdown<T extends string>` consumes `label`, `value`, `onChange`, and `{ value, label }[]` options and renders a labelled native select with shared light-theme styling.

- [ ] **Step 1: Write failing primitive tests**

Test that `Modal` exposes `role="dialog"`, its accessible name, close control, and provided children; test that `Dropdown` has a label, exposes the selected value, and calls `onChange` with a new option; test that `Button` retains disabled semantics.

- [ ] **Step 2: Run the primitive test file to verify failure**

Run: `pnpm exec vitest run src/components/ui/ui.test.tsx`  
Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement the five primitives**

Use the Home palette and focus treatment. `PageSurface` provides the cream background, ambient decorative layers, and a centred responsive content container; callers provide headings/content. `Card` and `Button` accept a limited visual variant prop rather than page-specific class strings. `Modal` supplies backdrop/close/focus styles but no auth policy. `Dropdown` styles a native select; it must not introduce a custom keyboard/listbox implementation.

- [ ] **Step 4: Run primitive tests and typecheck**

Run: `pnpm exec vitest run src/components/ui/ui.test.tsx && pnpm exec tsc -b`  
Expected: PASS with no TypeScript errors.

### Task 2: Global snackbar presentation

**Files:**
- Create: `src/components/ui/SnackbarProvider.tsx`
- Create: `src/components/ui/SnackbarProvider.test.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes React context and `RouterProvider` in `main.tsx`.
- Produces `SnackbarProvider` and `useSnackbar(): { showSuccess(message: string): void; showError(message: string): void }`.
- Later page tasks call the hook only after observing their existing fetcher result.

- [ ] **Step 1: Write failing snackbar tests**

Mount a consumer inside `SnackbarProvider`; assert success renders a dismissible `role="status"` message, error renders an assertive `role="alert"` message, and dismissing removes it. Assert a second call replaces the prior message so only one live snackbar region is visible.

- [ ] **Step 2: Run the snackbar test to verify failure**

Run: `pnpm exec vitest run src/components/ui/SnackbarProvider.test.tsx`  
Expected: FAIL because the provider/hook do not exist.

- [ ] **Step 3: Implement provider and wire it at the app root**

Render a fixed, non-blocking, light-theme snackbar region from the provider and wrap the existing `<RouterProvider router={router} />` in `main.tsx`. Do not add timeout animation; the close button is the required dismissal mechanism.

- [ ] **Step 4: Run snackbar tests and full typecheck**

Run: `pnpm exec vitest run src/components/ui/SnackbarProvider.test.tsx && pnpm exec tsc -b`  
Expected: PASS.

### Task 3: Settings visual grouping, shared dropdown, and save feedback

**Files:**
- Modify: `src/features/settings/SettingsPage.action.ts`
- Modify: `src/features/settings/SettingsPage.tsx`
- Modify: `src/features/settings/SettingsPage.test.tsx`

**Interfaces:**
- Consumes `Dropdown`, `PageSurface`, `Card`, `Button`, and `useSnackbar` from Tasks 1–2.
- Produces `SettingsActionData = UserSettings | { error: string }` from the action and an unchanged settings form API for its route.
- Calls `showSuccess('Settings saved')` after successful idle completion and `showError('Could not save settings')` for the structured error result.

- [ ] **Step 1: Extend the Settings page/action tests**

Update the action fixture type to permit `SettingsActionData`. Add a controlled action rejection test that expects the page to remain rendered, controls to retain their current values, and an alert containing `Could not save settings` to appear. Replace the inline `Saved` indicator expectation with the success snackbar expectation, including the existing delayed revalidation test. Assert both select fields still work through their labels after moving to `Dropdown`.

- [ ] **Step 2: Run Settings tests to verify failure**

Run: `pnpm exec vitest run src/features/settings/SettingsPage.test.tsx src/features/settings/SettingsPage.action.test.ts`  
Expected: FAIL because the action throws and no snackbar/dropdown is used.

- [ ] **Step 3: Implement the controlled Settings outcome shape**

In `SettingsPage.action.ts`, keep parsing settings and invoking `ensureUser`/`updateSettings` exactly once. Catch only the resulting error and return `{ error: 'Could not save settings' }`; retain the parsed settings response on success. In `SettingsPage.tsx`, narrow fetcher data before treating it as `UserSettings`, keep the current `wasInFlight` revalidation guard, and publish the appropriate snackbar once per completed request.

- [ ] **Step 4: Apply the Settings light-theme composition**

Replace the bare page and per-row layout with `PageSurface`, grouped `Card`s, shared `Dropdown`s, styled native checkbox/range controls, and the shared primary `Button`. Keep every setting name, value, input type, submit payload, and back link unchanged.

- [ ] **Step 5: Run Settings tests and typecheck**

Run: `pnpm exec vitest run src/features/settings/SettingsPage.test.tsx src/features/settings/SettingsPage.action.test.ts && pnpm exec tsc -b`  
Expected: PASS.

### Task 4: Authentication modal and Home auth feedback

**Files:**
- Modify: `src/features/auth/AuthModal.tsx`
- Modify: `src/features/course/CourseListPage.tsx`
- Modify: `src/features/course/CourseListPage.test.tsx`

**Interfaces:**
- Consumes `Modal`, shared input/button styles, and `useSnackbar`.
- Auth action response remains `{ authenticated?: boolean; error?: string; migrationError?: string }` from `CourseListPage.action.ts`.
- Home's existing fetcher owns display-name and sign-out submissions; notification tracking must distinguish auth/sign-out outcomes from a display-name update.

- [ ] **Step 1: Write failing auth/Home feedback tests**

Add route-backed tests for an AuthModal action resolving `{ error: 'Unable to sign in' }` (modal stays visible and alert announces the same message), resolving `{ authenticated: true }` (success status is announced and modal closes), and a Home sign-out result (success status is announced). Keep the existing navigation/card assertions.

- [ ] **Step 2: Run CourseList tests to verify failure**

Run: `pnpm exec vitest run src/features/course/CourseListPage.test.tsx`  
Expected: FAIL because no shared snackbar is rendered or called.

- [ ] **Step 3: Refactor AuthModal onto `Modal` and shared controls**

Keep input state, intent selection, fetcher submission shapes, and current inline error as-is. Add success/error snackbar publication from fetcher outcomes; only close after a successful auth result has been announced. Use the shared modal and buttons without changing auth logic.

- [ ] **Step 4: Add scoped sign-out feedback to Home**

Track the sign-out submission locally so its completed fetcher result alone publishes `Signed out successfully` or its returned error. Do not show snackbars for display-name edits. Bring the Home auth controls into the shared button treatment without altering their navigation or submit payloads.

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm exec vitest run src/features/course/CourseListPage.test.tsx && pnpm exec tsc -b`  
Expected: PASS.

### Task 5: Course-map and recovery-page light theme

**Files:**
- Modify: `src/features/course/CourseMapPage.tsx`
- Modify: `src/features/course/CourseMapPage.test.tsx`
- Modify: `src/app/RouteError.tsx`
- Modify: `src/app/NotFoundPage.tsx`
- Modify: `src/app/RouteError.test.tsx`
- Modify: `src/app/NotFoundPage.test.tsx`

**Interfaces:**
- Consumes `PageSurface`, `Card`, and `Button`/link styles from Task 1.
- Preserves `UnitSection`'s `open` state, `aria-expanded`, lesson routes, and exact `statusLabel` values.

- [ ] **Step 1: Extend course-map and recovery tests**

Assert a unit toggle remains a button with correct `aria-expanded`, each lesson remains a link even when labelled `Locked`, and empty units/course maps retain visible messages. Assert route-error/not-found content includes a decorative Jamozy public logo image with empty alt text and their existing user-facing messages.

- [ ] **Step 2: Run the affected tests to verify failure**

Run: `pnpm exec vitest run src/features/course/CourseMapPage.test.tsx src/app/RouteError.test.tsx src/app/NotFoundPage.test.tsx`  
Expected: FAIL on the new themed/recovery assertions.

- [ ] **Step 3: Implement CourseMap presentation**

Use `PageSurface` and a course-header card. Restyle expandable units as rounded cards and map the existing `completed`, `unlocked`, and `locked` labels to gentle pastel pills/icons. Do not make a locked lesson disabled or alter disclosure behaviour.

- [ ] **Step 4: Implement branded recovery cards**

Use `PageSurface` and a compact recovery `Card` in the two app-level pages, referencing a suitable existing `public/templates/jamozy-*.png` logo. Preserve their current error selection and text semantics.

- [ ] **Step 5: Run affected tests and typecheck**

Run: `pnpm exec vitest run src/features/course/CourseMapPage.test.tsx src/app/RouteError.test.tsx src/app/NotFoundPage.test.tsx && pnpm exec tsc -b`  
Expected: PASS.

### Task 6: Lesson, Review, and keyboard practice surfaces

**Files:**
- Modify: `src/features/lesson/LessonDetailPage.tsx`
- Modify: `src/features/lesson/LessonTypingSession.tsx`
- Modify: `src/features/lesson/LessonDetailPage.test.tsx`
- Modify: `src/features/review/ReviewPage.tsx`
- Modify: `src/features/review/ReviewTypingSession.tsx`
- Modify: `src/features/review/ReviewPage.test.tsx`
- Modify: `src/features/typing/VirtualKeyboard.tsx`
- Modify: `src/features/typing/VirtualKeyboard.test.tsx`

**Interfaces:**
- Consumes Task 1 primitives only for presentation.
- Retains `LessonCompletion`, `SubmitReviewSessionOutcome`, all `onComplete` callbacks, keyboard settings, session-store calls, keystroke handling, and current route navigation exactly as-is.

- [ ] **Step 1: Add regression tests for themed semantic states**

Extend lesson/review page tests to cover preview/start/completion headings, empty content messages, and existing completion navigation. Extend VirtualKeyboard tests to cover the current highlighted next key, Shift state, English-key visibility, and passed opacity. Tests must assert accessible content/behaviour rather than Tailwind class names.

- [ ] **Step 2: Run lesson/review/keyboard tests to establish the baseline**

Run: `pnpm exec vitest run src/features/lesson/LessonDetailPage.test.tsx src/features/review/ReviewPage.test.tsx src/features/typing/VirtualKeyboard.test.tsx`  
Expected: Existing tests pass; new semantic-state tests fail until presentation changes provide the targeted landmarks/labels.

- [ ] **Step 3: Restyle Lesson and Review state branches**

Wrap all preview, active, saving, completion, and empty branches in the shared page/surface system. Use clear progress labels, warm exercise/review cards, pastel correctness states, and grouped metric cards. Preserve target/meaning/romanization text, all button labels, and navigation destinations.

- [ ] **Step 4: Restyle the VirtualKeyboard**

Replace slate/amber key classes with the shared cream card palette and a calm contrasting next-key/Shift state. Keep DOM key labels, `aria-label`s, the `style={{ opacity }}` contract, and all props unchanged.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `pnpm exec vitest run src/features/lesson/LessonDetailPage.test.tsx src/features/review/ReviewPage.test.tsx src/features/typing/VirtualKeyboard.test.tsx && pnpm exec tsc -b`  
Expected: PASS.

### Task 7: Profile light-theme dashboard

**Files:**
- Modify: `src/features/profile/ProfilePage.tsx`
- Modify: `src/features/profile/ProfilePage.test.tsx`

**Interfaces:**
- Consumes `PageSurface` and `Card` from Task 1.
- Retains `ProfileLoaderData`, metric calculations, `formatTypingTime`, native `<progress>`, optional session aggregate condition, and Home link.

- [ ] **Step 1: Add profile rendering regressions**

Assert level, EXP progress accessible label/value, all six metrics, the optional session aggregate, and the back link remain present for a populated summary; assert the aggregate stays absent when exercises attempted is zero.

- [ ] **Step 2: Run the profile test to verify the added assertions**

Run: `pnpm exec vitest run src/features/profile/ProfilePage.test.tsx`  
Expected: PASS before visual implementation if the semantics already exist; this task is a regression baseline for the purely presentational refactor.

- [ ] **Step 3: Implement the profile dashboard treatment**

Use a gentle level/EXP hero card, a responsive grid of pastel metric cards, and a separate session-summary card. Keep all values and copy intact; only improve visual grouping and hierarchy.

- [ ] **Step 4: Run profile test and typecheck**

Run: `pnpm exec vitest run src/features/profile/ProfilePage.test.tsx && pnpm exec tsc -b`  
Expected: PASS.

### Task 8: Whole-app verification and visual QA

**Files:**
- Modify only if verification exposes a scoped presentation/test issue from Tasks 1–7.

**Interfaces:**
- Consumes the complete shared UI system and existing router.
- Produces verified Light-theme UI with no functional regressions.

- [ ] **Step 1: Run the complete automated suite**

Run: `pnpm test -- --run && pnpm lint && pnpm build`  
Expected: all tests, lint, and production build pass.

- [ ] **Step 2: Perform browser visual QA**

Run: `pnpm dev -- --host 127.0.0.1` and inspect Home plus each route at desktop and a narrow mobile viewport. Verify cream/pastel system, readable contrast, no clipped decorative assets, keyboard usability, modal stacking, dropdown controls, and snackbar placement.

- [ ] **Step 3: Fix only verification findings within spec**

Re-run the directly affected tests and then the full command from Step 1. Do not expand scope into dark theme, animation, or logic changes.

## Plan self-review

- **Spec coverage:** Tasks 1–2 implement the shared system; Task 3 covers Settings and its permitted action outcome; Task 4 covers auth/sign-out; Tasks 5–7 cover every remaining page/surface; Task 8 validates desktop/mobile integration.
- **Type consistency:** `SnackbarProvider/useSnackbar`, `SettingsActionData`, `Modal`, and `Dropdown` are defined before their consuming tasks; only `SettingsActionData` crosses a feature/action boundary.
- **Review focus coverage:** each of the five listed conditions is assigned to a concrete task/test step.
- **Proportion:** tasks define component contracts, exact boundaries, and test intent without transcribing implementation bodies.
