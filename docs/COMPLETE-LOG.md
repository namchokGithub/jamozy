# Completion Log

Chronological log of completed units of work. One entry per meaningful change (not every commit). Newest at the bottom.

---

### 2026-09-23 — Repository initialized

- Initial commit (`877bb19`).
- README written: product overview, core features, learning flow, tech stack, architecture, folder structure, theme direction, Firestore data model, MVP checklist, development principles (`dae2c7e`).
- `.gitignore` updated for standard Node/Vite project (`6e001de`).

### 2026-09-23 — Agent/project docs added

- Added `AGENTS.md` (shared agent instructions: architecture rules, commands, folder layout, working conventions).
- Added `CLAUDE.md` (Claude Code specific workflow notes, docs-upkeep rules).
- Added `docs/DECISIONS.md` (decision log, seeded with DEC-001..DEC-004 from README's stated design choices).
- Added `docs/PROGRESS.md` (MVP + Later + foundational-setup progress tracker).
- Added `docs/COMPLETE-LOG.md` (this file).

### 2026-09-23 — Domain model spec added

- Added `docs/DOMAIN-MODEL.md`: field-level schema for Course/Unit/Lesson/Progress/ReviewItem, plus a tentative UserProfile shape and 4 open questions (EXP/Level storage, settings location, review scheduling, unlock rule) flagged for later decision.

### 2026-09-23 — Project scaffold

- Initialized `package.json`, installed React 19.3, Vite 7.3.6, TypeScript 5.9.3 (pinned to match README's documented majors), Tailwind CSS 4 (`@tailwindcss/vite`), React Router, Zustand, Firebase SDK, Zod, Motion, Lucide React.
- Added ESLint flat config (`eslint.config.js`) + Prettier (`.prettierrc.json`); `pnpm lint` passes.
- Added Vitest + React Testing Library (`src/test/setup.ts`); `pnpm exec vitest run` passes with a smoke test (`src/App.test.tsx`).
- Built `src/domain/models/{course,unit,lesson,progress,review-item}.ts` and `src/domain/repositories/{course,lesson,progress,review}-repository.ts` per `docs/DOMAIN-MODEL.md`.
- Created empty `src/application/`, `src/infrastructure/firebase/{repositories,mappers}/`, `src/features/{lesson,course,review}/` directories, left unfilled pending Firebase wiring and the open decisions in `docs/DOMAIN-MODEL.md`.
- Verified `pnpm build`, `pnpm lint`, `pnpm exec vitest run` all pass.
- Recorded `docs/DECISIONS.md` DEC-005: pinned `@vitejs/plugin-react` to `5.2.0` (latest `6.x` requires Vite 8, breaking the README-pinned Vite 7).
- Not yet committed to git.

### 2026-09-23 — Firebase SDK wired

- User created the `jamozy` Firebase project and provided `.env.local`. Fixed: values used `NEXT_PUBLIC_*` prefix (Next.js convention) — Vite only exposes `VITE_*` to client code, renamed all keys.
- Added `src/vite-env.d.ts` with a typed `ImportMetaEnv` for the `VITE_FIREBASE_*` vars.
- Added `src/infrastructure/firebase/firebase.ts`: `initializeApp`, exported `auth`/`db`, `signInAnonymouslyIfNeeded()`, optional emulator connection gated on `VITE_FIREBASE_USE_EMULATOR`.
- Added `.env.example` (committed) mirroring the required `VITE_FIREBASE_*` keys; updated `README.md` env block to include `VITE_FIREBASE_USE_EMULATOR`.
- Added smoke test `src/infrastructure/firebase/firebase.test.ts`; `pnpm build`, `pnpm lint`, `pnpm exec vitest run` all pass.
- `.env.local` is still missing `VITE_FIREBASE_MESSAGING_SENDER_ID`/`VITE_FIREBASE_APP_ID` — needs a Web App registered under the Firebase project.

### 2026-09-23 — Firebase console setup + repository implementations

- User enabled Anonymous Auth provider and created the Firestore database in the `jamozy` Firebase project console.
- Implemented `src/infrastructure/firebase/repositories/{firebase-course,firebase-lesson,firebase-progress,firebase-review}-repository.ts` against the four `domain/repositories` interfaces.
- Added `src/infrastructure/firebase/mappers/{lesson,progress}-mapper.ts` (Firestore Timestamp ↔ Date conversion, per README's folder structure).
- `pnpm build`, `pnpm lint`, `pnpm exec vitest run` all pass.
- Not yet exercised against real data — no seed course/unit/lesson content, and no `application/` use cases call these repositories yet.

### 2026-09-23 — Resolved DOMAIN-MODEL.md open questions

- User answered all 4 open questions: EXP/Level derived from `exp` (not stored), Settings as a field on `users/{userId}`, spaced repetition (Leitner boxes) for review scheduling, sequential unlock (previous lesson completed → next unlocked).
- Recorded `docs/DECISIONS.md` DEC-006 (derived level), DEC-007 (settings location), DEC-008 (Leitner scheduling), DEC-009 (sequential unlock rule). Updated `docs/DOMAIN-MODEL.md` to close out the Open Questions section.
- Added `src/domain/models/user-profile.ts` (`UserProfile`, `UserSettings`, `levelFromExp`).
- Extended `src/domain/models/review-item.ts` with `box`/`nextReviewAt` fields and `nextBox`/`nextReviewDate` pure functions.
- Changed `ReviewRepository.markResolved(userId, itemId)` → `updateReviewItem(userId, item)` (generic persist, since spaced repetition needs to write `box`/`nextReviewAt`/`resolved` together); updated `FirebaseReviewRepository` to match.
- Added unit tests for `nextBox`, `nextReviewDate`, `levelFromExp`. `pnpm build`, `pnpm lint`, `pnpm exec vitest run` all pass (9 tests).

### 2026-09-23 — Cross-checked docs/requirement.md against domain model

- User provided `docs/requirement.md`, a detailed product spec. Cross-checked it against `docs/DOMAIN-MODEL.md`/`docs/DECISIONS.md`, found 8 discrepancies, user resolved each:
  - Reaffirmed unchanged (requirement.md's suggestion rejected): spaced repetition stays Leitner-box ([[DEC-008]]), EXP/Level formula stays flat ([[DEC-006]]), lesson status stays 3-state `locked/unlocked/completed` ([[DEC-009]]), level stays derived-only (not a separately saved field, [[DEC-006]]).
  - Adopted from requirement.md (schema changes, new decisions): `LessonExercise.difficulty`/`meaningTh`/`meaningEn` (DEC-010), new `UserStats` entity embedded on `UserProfile` (DEC-011), `ReviewItem.reason` (mistake/slow/low-accuracy, DEC-012), full 7-field `UserSettings` replacing the 2-field placeholder (DEC-013).
- Code updated: `src/domain/models/lesson.ts` (`ExerciseDifficulty`, `LessonExercise` fields), `src/domain/models/review-item.ts` (`ReviewReason`, `reason` field), `src/domain/models/user-profile.ts` (full `UserSettings`, new `UserStats`, `UserProfile.stats`), `src/infrastructure/firebase/repositories/firebase-review-repository.ts` (`reason` mapping).
- `docs/requirement.md` left unedited — it's the user's source spec; `docs/DECISIONS.md`/`docs/DOMAIN-MODEL.md` are the authoritative resolved state where they disagree.
- `pnpm build`, `pnpm lint`, `pnpm exec vitest run` all pass (9 tests, unchanged — no new pure logic added this pass, only data shapes).

### 2026-09-23 — Updated docs/requirement.md to match resolved decisions

- User asked for `docs/requirement.md` itself to be updated (superseding the "leave it unedited" call from the previous entry). Edited 4 spots, each cited with `[[DEC-xxx]]`: spaced repetition flipped from "not needed for MVP" to "in for MVP" ([[DEC-008]]), lesson status trimmed from 4 states to 3 (`locked/unlocked/completed`, [[DEC-009]]), EXP/Level example fixed to the flat formula (`Level 7, 50/100 EXP` at exp=650, [[DEC-006]]), "Level" removed from the Save System's stored list (derived only, [[DEC-006]]).

### 2026-09-23 — Built application/ use cases, extended repositories, wrote seed content

- Added `domain/repositories/user-profile-repository.ts` + `FirebaseUserProfileRepository`, and `CourseRepository.getUnitById` + its Firebase implementation — both needed by `complete-lesson` (not in README's original repository list, see [[DEC-014]]).
- Built all 5 `application/` use cases from README plus a 6th (`submit-review-result.ts`, needed to actually drive spaced repetition — [[DEC-014]]): `get-course.ts`, `get-lesson.ts`, `update-progress.ts`, `complete-lesson.ts`, `get-review-items.ts`, `submit-review-result.ts`.
- `complete-lesson.ts` wires together progress update, sequential unlock (same-unit and cross-unit, [[DEC-009]]), EXP award per `docs/requirement.md` #8 (100 base / +20 if accuracy>90 / +50 if perfect), and `UserStats` updates — skips EXP/unlock on a retry of an already-completed lesson ([[DEC-014]]).
- Added `src/test/fakes.ts` (in-memory fakes for all 5 repositories) and 20 new unit tests across the 6 use cases — total 29 tests, all passing, no Firebase/network required.
- Added sample seed content (`src/infrastructure/firebase/seed/sample-content.ts`: 1 course, 2 units, 2 lessons, 6 exercises) and a standalone seed script (`scripts/seed-firestore.ts`, `pnpm seed`, using `dotenv`+`tsx`, both added as devDependencies).
- `pnpm build`, `pnpm lint`, `pnpm exec vitest run` all pass.
- **Not yet run**: `pnpm seed` against the live Firestore database — writes to the real `jamozy` project, held pending explicit user go-ahead.

### 2026-09-23 — pnpm seed hit PERMISSION_DENIED, added Firestore rules

- User ran `pnpm seed` themselves against the live `jamozy` project: failed with `FirebaseError: 7 PERMISSION_DENIED: Missing or insufficient permissions.` — the Firestore database had no rules deployed (default deny-all).
- Asked user how to unblock (Admin SDK + service account, vs. open client rules); user chose to add `firestore.rules` and deploy it themselves.
- Added `firestore.rules` (content collections readable/writable by any signed-in user; `users/{userId}` and subcollections restricted to the owning `uid`), `firebase.json`, `.firebaserc` (project alias `jamozy`).
- Recorded `docs/DECISIONS.md` DEC-015: **flags a real, not just theoretical, security gap** — content write access isn't restricted to an admin role (none exists yet), so any signed-in player can currently rewrite `courses`/`units`/`lessons` via the client SDK. Must be replaced (custom-claims admin role, or Admin SDK/Cloud Function-only content writes) before any public launch. User-data rules are already correct/production-safe.
- Did not run `firebase deploy` — user will run `firebase login` then `firebase deploy --only firestore:rules` themselves, then re-run `pnpm seed`.

### 2026-09-23 — Seed succeeded

- User deployed `firestore.rules` and re-ran `pnpm seed`: `Seed complete.` — `courses`/`units`/`lessons` now hold real sample content in the live `jamozy` Firestore database (1 course, 2 units, 2 lessons, 6 exercises).
- [[DEC-015]]'s MVP-only security gap (any signed-in user can write content collections) still stands — not addressed, just deployed as-is per the earlier decision.

### 2026-09-23 — First UI feature: course list, course map, lesson detail

- Followed the full brainstorming → spec → plan → native-execution → final-review workflow (superpowers skills). Spec: `docs/superpowers/specs/2026-09-23-course-lesson-ui-design.md`. Plan: `docs/superpowers/plans/2026-09-23-course-lesson-ui.md` (7 tasks).
- Built: `getCourseMap` use case (`application/get-course.ts`); `CourseListPage`/`CourseMapPage`/`LessonDetailPage` + their `*.loader.ts` factories; `RouteError`/`NotFoundPage`; `src/app/router.ts` (React Router `createBrowserRouter`, `Component`/`ErrorBoundary` fields, no JSX in the route config); `infrastructure/firebase/repositories/index.ts` (singleton repos for loaders). Replaced the placeholder `App.tsx` with `RouterProvider`.
- Manual browser verification (Task 7, Step 9) found 2 real bugs no unit test caught: loaders reading Firestore content without signing in first (`firestore.rules` requires `request.auth != null`), and a missing Firestore composite index for `units`/`lessons` queries. Both fixed; user deployed the new `firestore.indexes.json` (`firebase deploy --only firestore:indexes`) before the fix could be verified live.
- Dispatched a fresh-context final review (Opus) against the whole branch. Verdict: ready to merge with fixes, no Critical findings. Fixed all 4 Important findings in one TDD pass: (1) the auth-before-read fix from Task 7 was duplicated across 3 loaders untested and violated `AGENTS.md`'s layering rule (`features/` importing `infrastructure/firebase` directly) — replaced with an injected `ensureUser` dependency, bound once in `router.ts`, with a test per loader; (2) added `domain/errors.ts` (`NotFoundError`) so a missing course/lesson renders "Not found." instead of a generic "Something went wrong."; (3) added empty-state text ("No courses/units/lessons/exercises yet.") everywhere a list could render empty, with tests for the previously-untested zero-units case; (4) this doc + `docs/PROGRESS.md` updated (was the 4th finding — docs hadn't caught up to Task 7). Recorded `docs/DECISIONS.md` DEC-016 covering both the index requirement and the `ensureUser` pattern.
- 9 declined-to-judge items from the reviewer each got an explicit ruling (agree/no-action, or deferred) — see the plan's ledger (`.superpowers/sdd/2026-09-23-course-lesson-ui/progress.md`) for the full list. 7 Minor findings deferred (not fixed this round): raw backend error messages shown to users, no "back home" links, loose `useLoaderData() as X` casts, stale doc references, bundle-size warning.
- Verified against the live `jamozy` Firestore in an actual browser: course list → course map (unit expand/collapse, "Locked" badges) → lesson detail (real Korean/romanization/meaning content) → 404 wildcard route. Screenshots taken, console checked clean.
- `pnpm build`/`lint`/`vitest run` all pass — 48 tests (up from 29).
- Work is split between a commit the user made mid-flight (`028ce86`, using a message drafted for them) and further staged-but-uncommitted changes (the rest of Task 7 + the entire fix pass) — user chose not to have commits made automatically per task.

### 2026-09-24 — Korean typing engine core logic

- Followed the same brainstorming → spec → plan → native-execution → final-review workflow. Spec: `docs/superpowers/specs/2026-09-23-korean-typing-engine-design.md`. Plan: `docs/superpowers/plans/2026-09-23-korean-typing-engine.md` (5 tasks).
- Built, framework-free, pure TypeScript: `src/domain/korean/keymap.ts` (2-beolsik physical-key map), `hangul.ts` (Unicode syllable compose/decompose + compound-jungseong/jongseong tables), `target-sequence.ts` (compiles a known target string into its exact expected keystrokes), `typing-session.ts` (jamo-level matching state machine: `startTypingSession`, `pressKey`, and derived selectors `getComposedText`/`getCharacterStates`/`getAccuracy`/`getProgress`). Plus `src/features/typing/session-store.ts` — a thin Zustand store, the first use of Zustand in this codebase.
- All 5 tasks completed with 36 new tests, all passing on first run against the hand-verified logic written into the plan itself.
- Dispatched a fresh-context final review (Opus), which independently re-derived the domain data rather than trusting the code: checked the Unicode Hangul syllable formula and the 19/21/28 jamo-list orderings against the browser's own NFD decomposition of all 11,172 precomposed Hangul syllables, checked the 2-beolsik keymap against KS X 5002, and verified the compound-jungseong (7)/compound-jongseong (11) tables. **No domain-data errors found.**
- Fixed all 3 Important findings in one TDD pass: (1) Shift state is now only checked strictly on keys that actually have a Shift variant (`ExpectedKey.strictShift`) — holding Shift on a plain key, e.g. right after typing a tense consonant, no longer wrongly counts as a mistake; (2) bare modifier keydowns (`ShiftLeft` etc.) are now ignored by `pressKey` rather than counted wrong; (3) a half-typed compound jungseong/jongseong now composes progressively (shows 갑/호) instead of no visible change — this **supersedes** the plan's own Review Focus #3, which had originally specified no partial display for a half-typed compound jongseong. Recorded `docs/DECISIONS.md` DEC-017 with the full reasoning for all three.
- 7 declined-to-judge items and 6 Minor findings recorded in the plan's ledger (`.superpowers/sdd/2026-09-23-korean-typing-engine/progress.md`) — deferred, not fixed this round (lone-jamo handling inconsistency, NFD input normalization, a few suggested extra tests, missing `beforeEach` in the store test, O(n²) selectors — negligible at exercise scale, stale spec header).
- `pnpm build`/`lint`/`vitest run` all pass — 88 tests (up from 48).
- Nothing committed via `git commit` this round either — all 10 files (+ the fix-pass changes to 2 of them) staged, user commits manually as before.

### 2026-09-24 — Interactive "Start Lesson" flow: lesson typing session

- Followed the same brainstorming → spec → plan → native-execution → final-review workflow. Spec: `docs/superpowers/specs/2026-09-24-lesson-typing-session-design.md`. Plan: `docs/superpowers/plans/2026-09-24-lesson-typing-session.md` (9 tasks).
- Wired the Korean typing engine ([[DEC-017]]) into a real interactive flow: `src/domain/korean/lesson-session.ts` (new — sequences a lesson's multiple exercises through the engine, aggregates accuracy/WPM/mistakes, 0–100 accuracy scale per [[DEC-018]]), `application/create-review-items.ts` + `ReviewRepository.getReviewItem` (new — deterministic point-lookup `ReviewItem` creation, [[DEC-018]]), `application/complete-lesson-session.ts` (new — orchestrates the existing `complete-lesson` + the new review-item creation), `LessonDetailPage.action.ts` (new — the React Router action, Zod-validated), `src/features/typing/{VirtualKeyboard,lesson-session-store}.ts` (new), `src/features/lesson/LessonTypingSession.tsx` (new — the interactive component), and `LessonDetailPage.tsx`/`src/app/router.ts` wired together at the end.
- Manual browser verification against the live `jamozy` Firestore: typed a full lesson end to end (virtual keyboard highlighting, wrong-key rejection, auto-advance between exercises, EXP/level/unlock on completion), confirmed a repeat-completion attempt correctly awards `+0 EXP` without crashing.
- Dispatched a fresh whole-branch review (Opus). Found 1 Critical, 2 Important, 6 Minor. Fixed both required findings in one TDD pass:
  - **Critical:** a cross-mount stale-session bug — `useLessonSessionStore` is a module-level singleton, so on the most ordinary real path (finish lesson A, go back to the course map via the app's own links, open lesson B — no page reload) `LessonTypingSession` could read lesson A's already-completed session the instant it mounted for lesson B, silently "completing" B with A's data before the learner typed anything (wrong Progress/EXP, a wrongly-unlocked next lesson, a double-incremented `ReviewItem.mistakeCount`). Reproduced independently via real SPA browser navigation, not just the reviewer's report. A first fix attempt passed every unit test but still failed live, because `src/main.tsx` wraps the app in `<StrictMode>` and its dev-mode double-invoke of mount effects defeats a one-shot ref guard; the real fix is a `generation` counter on the store (see [[DEC-018]]), and `LessonTypingSession.test.tsx` now renders through `<StrictMode>` so this class of bug is caught by `vitest run`, not only by manual browser checks.
  - **Important:** the Review Focus #4 (listener cleanup) test was replaced with a behavioral one — dispatch a keydown after `unmount()` and assert the store didn't change — instead of only checking that `removeEventListener('keydown', ...)` was called with any function.
  - Also caught, before the reviewer, by a routine `git log`/`git diff` sanity check on staged files: `LessonDetailPage.test.tsx` was not a new file, and my first pass had silently dropped its 2 existing tests (exercise rendering, empty-state message) — restored alongside the 2 new tests.
  - 6 Minor findings deferred (not fixed this round, see the plan's ledger for the full reasoning): page state surviving a lesson-id change without a `key` prop (unreachable today), `ReviewItem.id` uniqueness only documented as lesson-local not enforced as global, Progress/EXP and ReviewItem writes not atomic, `VirtualKeyboard` never highlights Space, the zero-exercise path is correctly handled but unreachable through the current UI, and the older single-exercise `session-store.ts` has no remaining non-test consumer.
- Recorded `docs/DECISIONS.md` DEC-018 (accuracy-scale boundary, deterministic `ReviewItem` id, the `generation`-counter fix and why a one-shot flag wasn't enough). Ticked README's MVP checklist for Lesson flow, Korean typing engine, Virtual Korean keyboard, Accuracy and speed tracking, Firestore progress persistence; updated `docs/PROGRESS.md` to match (was stale from before this round — its own whitespace had also drifted from an earlier session's unstaged edit, fixed in the same pass).
- `pnpm build`/`lint`/`vitest run` all pass — 122 tests (up from 88).
- Nothing committed via `git commit` this round — all files staged, user commits manually as before.

### 2026-09-24 — Review System UI

- Followed the same brainstorming → spec → plan → native-execution → final-review workflow. Spec: `docs/superpowers/specs/2026-09-24-review-session-design.md`. Plan: `docs/superpowers/plans/2026-09-24-review-session.md` (8 tasks).
- Wired the already-existing, already-tested `application/get-review-items.ts` and `application/submit-review-result.ts` use cases into real UI for the first time: `application/submit-review-session.ts` (new — per-item `wasCorrect`/box orchestration, uid-scoped point lookups, never a client-supplied user id), `src/features/review/{ReviewPage,ReviewPage.loader,ReviewPage.action,ReviewTypingSession}` (new — the `/review` route), `CourseListPage`/`CourseListPage.loader.ts` (modified — a due-count badge), `get-review-items.ts` (modified — an optional, unbounded-by-default `limit`), `src/app/router.ts` (wired). Deliberately reused, unchanged: `lesson-session.ts`, `lesson-session-store.ts`, `VirtualKeyboard.tsx` — a review item maps to the same `{id, targetText}` shape a lesson exercise does, so no new domain logic was needed to sequence a review session.
- Manual browser verification against the live `jamozy` Firestore: confirmed the empty state at `/` (no due-count badge) and `/review` ("Mistyped words are added to your Review queue and become available when due.") against real data; completed a lesson with a deliberate mistake to create/update a real `ReviewItem` via the already-shipped `create-review-items.ts` path, then confirmed both pages still correctly showed nothing due afterward (a freshly-mistaken item's `nextReviewAt` is 1 day out) — proving the due-filtering logic reads live data faithfully rather than being wired to something that always shows up. Did not hand-edit `nextReviewAt` in the Firebase console to fabricate a due item for a full "Start Review → type → summary" live walkthrough — that would cross CLAUDE.md's Firebase Caution line; that flow is instead exercised end-to-end by the Vitest suite against fakes.
- Dispatched a fresh whole-branch review (Opus), which also mutation-tested each of the plan's 5 Review Focus pins (each one's guard was individually broken and confirmed the corresponding test then failed) — including reverting `ReviewTypingSession.tsx`'s `generation`-counter guard back to the prior round's rejected one-shot-ref approach, which the `<StrictMode>`-wrapped test correctly caught again. Found 0 Critical, 1 Important, 9 Minor.
  - **Important:** this documentation-upkeep pass itself (README/PROGRESS/COMPLETE-LOG/DECISIONS hadn't been updated yet) — not a code defect.
  - 9 Minor findings deferred, not fixed this round (see `docs/PROGRESS.md`'s Current Focus for the full list and `.superpowers/sdd/2026-09-24-review-session/progress.md` for the complete reasoning): a loosely-typed `itemId` in the action's Zod schema, `CourseListPage` now reading a learner's whole `reviewItems` subcollection per home-page visit, sequential (not parallel) per-item Firestore writes in `submit-review-session.ts`, no friendlier retry on a mid-session action failure, missing badge pluralization, an unpinned (but by-inspection-correct) zero-items case, no explicit re-visit-after-summary test, and stray non-typing keys resetting a review item's box (pre-existing engine behavior, not introduced this round).
- Recorded `docs/DECISIONS.md` DEC-019 (unbounded due-count default vs. session cap, strict per-item `wasCorrect`, no same-session requeue, and the `generation` counter's second consumer). Ticked README's MVP checklist for Review system; updated `docs/PROGRESS.md` to match.
- `pnpm build`/`lint`/`vitest run` all pass — 142 tests (up from 122).
- Nothing committed via `git commit` this round — all files staged, user commits manually as before.

### 2026-09-24 — Settings UI

- Followed the same brainstorming → spec → plan → native-execution → final-review workflow. Spec: `docs/superpowers/specs/2026-09-24-settings-ui-design.md`. Plan: `docs/superpowers/plans/2026-09-24-settings-ui.md` (7 tasks).
- Built a persist-only `/settings` route on top of `UserProfile.settings`: `application/get-settings.ts` + `update-settings.ts` (new — read-modify-write, never touches `exp`/`stats`/`createdAt`), `src/features/settings/{SettingsPage,SettingsPage.loader,SettingsPage.action}` (new). Deliberately out of scope: none of the 7 settings (sound, keyboard visibility/opacity, romanization, meaning language, theme) affect any other screen's behavior yet — that's separate future work, one setting at a time.
- Refactored `defaultUserProfile` out of `complete-lesson.ts` (where it was private) into an exported function in `domain/models/user-profile.ts`, reused by both the lesson-completion path and the new settings use cases. `complete-lesson.test.ts` was left completely unmodified and still passes — the regression proof that the move changed nothing.
- Manual browser verification against the live `jamozy` Firestore found two real, independent bugs that no unit test had caught before that point:
  - **Bug 1:** a successful React Router action revalidates the route's own loader, so `useFetcher().state` goes `submitting → loading → idle`, not just `submitting → idle`. A first implementation of the Save button's "Saved" indicator tracked only "was submitting" via a ref, which got reset during the `loading` (revalidation) phase and never reached the `idle` check — "Saved" never appeared against real Firestore latency, though it accidentally passed against fast-resolving test fakes (which let React batch `loading` and `idle` into one render). Fixed by tracking "was in flight" (`fetcher.state !== 'idle'`) instead. A new test drives a controlled multi-phase loader/action to force `loading` to be its own observed render, pinning this class of bug the way `LessonTypingSession.test.tsx`'s `<StrictMode>` wrap pins a related-but-different one.
  - **Bug 2:** the "has this changed since the last save" check was `JSON.stringify(settings) === JSON.stringify(savedSnapshot)`. The loader's settings (Firestore-sourced, whatever field order the repository mapper produces) and the action's echoed-back settings (`userSettingsSchema.parse(...)`, always in Zod's schema-definition field order) can hold byte-identical values with different key insertion order — `JSON.stringify` treated those as different, so "Saved" silently never rendered even after fixing Bug 1. Found by injecting a live state dump into the running page and diffing the two objects' actual serialized output. Fixed by replacing the whole-object comparison with explicit field-by-field equality across `UserSettings`'s 7 fields. A regression test constructs the same values in deliberately different key orders and was confirmed RED against the old code, GREEN against the fix.
  - Diagnosing both required escalating past the browser extension's simulated clicks and console-message tracking, which proved unreliable across many attempts for this specific page — resolved by driving the page with fully deterministic programmatic JS (`javascript_tool`) instead.
- Dispatched a fresh whole-branch review (Opus), which independently reverted each of the two fixes and confirmed each one's own regression test fails without it, and grepped the rest of `src/` confirming no other `JSON.stringify`-based equality check exists in shipped code. Found 0 Critical, 1 Important, 7 Minor.
  - **Important:** this documentation-upkeep pass itself — not a code defect.
  - 7 Minor findings deferred, not fixed this round (see `docs/PROGRESS.md`'s Current Focus for the full list): Save re-enables during the post-save loader revalidation, not just `submitting`; "Saved" can show a moment early when nothing was actually edited; `getSettings` doesn't merge stored settings over the defaults field-by-field (forward-compatibility only, no live document is missing a field today); a Save failure replaces the whole page via `RouteError` (matches every other route); no Firestore transaction around the read-modify-write (matches `complete-lesson`'s existing pattern); the multi-phase test doesn't separately assert the Save button was disabled mid-flight; missing `aria-live` on "Saved" and no visible numeric value on the opacity slider.
- Recorded `docs/DECISIONS.md` DEC-020 (the `defaultUserProfile` extraction, and the full narrative of both bugs). Ticked README's MVP checklist for Settings; updated `docs/PROGRESS.md` to match.
- `pnpm build`/`lint`/`vitest run` all pass — 163 tests (up from 142).
- Nothing committed via `git commit` this round — all files staged, user commits manually as before.

### 2026-09-24 — Wire meaningLanguage/romanizationEnabled into LessonDetailPage

- Bounded change (brainstorming skill classification): existing flow, existing settings data, no new subsystem. Scoped to `LessonDetailPage` only, not `ReviewPage`'s preview list, per explicit confirmation. In-chat design approved, no spec/plan document, implemented directly via TDD.
- `LessonDetailPage.loader.ts` now also calls `application/get-settings.ts`, run in `Promise.all` alongside `getLesson` since neither depends on the other. `LessonDetailLoaderData` gains a `settings: UserSettings` field.
- New `src/features/lesson/format-exercise-meaning.ts`: pure `formatExerciseMeaning(exercise, meaningLanguage)` — th/en/both, joins with `' / '`, omits an empty `meaningTh`/`meaningEn` rather than rendering a blank slot, returns `null` when nothing to show. `LessonDetailPage.tsx` uses it to render the meaning line and gates the existing romanization line on `settings.romanizationEnabled`.
- The formatter was first defined inline in `LessonDetailPage.tsx` and exported for its own tests; that export tripped `react-refresh/only-export-components` (first lint warning of the whole session) since a component file can only export components for Fast Refresh to work. Extracted to its own file with its own test file to fix it.
- No fresh-reviewer dispatch — not required for bounded-path work per the brainstorming skill; verified instead by TDD (7 new pure-function tests, 2 new component tests covering both-shown/romanization-hidden/th-only cases) plus manual live-browser verification against real Firestore data (toggled `meaningLanguage`/`romanizationEnabled` via Settings, confirmed the lesson page reflected both, then reverted and reconfirmed the original behavior — no console errors).
- No `docs/DECISIONS.md` entry — no non-obvious tradeoff beyond the Fast-Refresh-driven file split, which is a mechanical lint fix, not a design decision. Updated `docs/PROGRESS.md`'s Settings row and Current Focus to match; README's Settings checkbox was already ticked, no new box for this.
- `pnpm exec vitest run`/`tsc -b`/`pnpm lint` all pass — 173 tests (up from 163).
- Nothing committed via `git commit` this round — all files staged, user commits manually as before.

### 2026-09-25 — Profile Dashboard

- Followed the full architectural workflow: brainstorming → spec (`docs/superpowers/specs/2026-09-24-profile-dashboard-design.md`) → plan (`docs/superpowers/plans/2026-09-24-profile-dashboard.md`, 5 tasks) → native execution → fresh Opus review → fix pass.
- New read-only `/profile` route: `application/get-profile-summary.ts` (mirrors `get-settings.ts` — pure read, falls back to `defaultUserProfile` for a new user, never writes) → `features/profile/ProfilePage.loader.ts` → `features/profile/ProfilePage.tsx`, showing level, an EXP progress bar (`exp % 100` out of the existing flat-100-per-level rule from `levelFromExp`), and all 6 `UserStats` fields. A new pure `format-typing-time.ts` formats `totalTypingTimeSeconds` into `"N min"`/`"Xh Ym"`, kept in its own file for the same Fast-Refresh reason as `format-exercise-meaning.ts` (a prior round's lint fix). `CourseListPage` gained a "Profile" nav link next to the existing "Settings" one.
- No new domain fields — `UserProfile.exp` and `UserStats` already carried everything this page needed.
- Dispatched a fresh whole-branch review (Opus). Found 0 Critical, 3 Important, 3 Minor.
  - **Fixed:** `averageAccuracy`/`bestAccuracy`/`averageSpeedWpm` were rendering as long unrounded floats for any real user (they're running averages, almost never whole numbers) — every test fixture up to that point used tidy hand-picked numbers that hid this. Now `Math.round()`ed at render time only; stored values untouched (see [[DEC-021]]). New tests use a realistic non-round fixture.
  - **Fixed:** the spec's "EXP progress bar" was text-only, no actual bar element — added a native `<progress>` element, tested via its `value`/`max` properties.
  - **Not a code fix:** the 3rd Important finding was this documentation-upkeep pass itself, done here.
  - 3 Minor findings deferred, not fixed this round (see `docs/PROGRESS.md`'s Current Focus for the full list): no back-link from `/profile` to `/` (matches `SettingsPage`'s existing gap); `ProfileSummary` defaulting to zero for a hypothetical profile document missing fields (theoretical); one loader test's nondeterministic `createdAt` (harmless, unasserted).
- Manual browser verification: the existing-user case was verified live against real Firestore in the developer's own Chrome (Level 3, partial EXP, unscaled accuracy — this run is what surfaced the long-decimal rendering the review then caught precisely). The true zero-state case was verified live in a separate, isolated Playwright-driven browser (Level 1, all stats zeroed, no NaN/undefined, no console errors) after a manual-testing storage-clearing step (an attempt to force a fresh anonymous user by wiping localStorage/IndexedDB) left the developer's own Chrome profile's `localhost:5173` origin storage stuck — a self-inflicted side effect of the verification process itself, not an app defect, most likely caused by a stray tab from `pnpm dev --open`'s auto-launch holding a live IndexedDB connection that blocked new opens/deletes from other tabs. Flagged to the user with a one-line fix (close other `localhost:5173` tabs, or clear site data for `localhost` via `chrome://settings/content/all`).
- Recorded `docs/DECISIONS.md` DEC-021 (display-only rounding convention for running-average stats). Ticked README's MVP checklist for "EXP and Level progression"; updated `docs/PROGRESS.md` to match.
- `pnpm exec vitest run`/`tsc -b`/`pnpm lint` all pass — 189 tests (up from 187 after Task 5, up from 173 before this round).
- Nothing committed via `git commit` by the user this round — all commits so far were made directly by the assistant during plan execution (per `superpowers:executing-plans`' per-task commit steps, needed for the plan's ledger/review tooling); the user has not yet been asked whether to squash them before their own review.

### 2026-09-27 — Keyboard settings and Review preview context

- Implemented all remaining keyboard consumers: `showKeyboard`, `showEnglishKeys`, and `keyboardOpacity` now control `VirtualKeyboard` in both lesson and review typing sessions. New profiles default to 0.7 opacity; existing persisted settings are left intact.
- Added `application/get-review-previews.ts`, which batches source-lesson reads by id and resolves optional source exercises through `LessonRepository`. Missing source lessons/exercises preserve their `ReviewItem.targetText` as a Korean-only preview rather than hiding the review item.
- Updated `/review` to load settings alongside due review items and render romanization/meaning in its preview list with the same preferences as Lesson detail. Active review typing deliberately remains Korean-only.
- Added RED→GREEN coverage for keyboard display settings, default profile opacity, source joins/deduplication/fallback, loader data, and preference-aware Review rendering.
- Whole-branch review found and fixed a stale-source safeguard: an exercise must now match both its id and target text before supplying Review metadata, so edited source content cannot pair an old Korean target with new meaning/romanization. Regression test confirmed RED→GREEN.
- Verified `pnpm test` (204/204), `pnpm exec tsc -b`, and `pnpm lint` all pass. No Git commit created.

### 2026-09-27 — Profile and Settings back-links

- Added a `Back to Course List` link to both `/profile` and `/settings`, returning learners to `/` without changing loaders or persisted data.
- Added component tests for both links. Verified `pnpm test` (206/206), `pnpm exec tsc -b`, and `pnpm lint` all pass.

### 2026-09-27 — Domain-model refinements (documentation only)

- Recorded [[DEC-022]] and updated `docs/DOMAIN-MODEL.md`: reusable `VocabularyEntry` records can link multiple lesson exercises; vocabulary review history deduplicates by `vocabularyId`, while non-vocabulary review remains lesson/exercise-scoped.
- Removed the conflicting target-model concept of `ReviewItem.resolved`; all review items remain in the Leitner schedule, including box 5.
- Replaced ambiguous/derived `UserStats` fields with raw aggregate counters: `exercisesAttempted`, accepted/rejected keystrokes, and typing duration. Accuracy and WPM are now explicitly derived; retries count as practice activity but not as newly completed lessons.
- No application, domain TypeScript, Firestore, or migration code changed in this documentation pass.

### 2026-09-27 — Learning Modes architecture (documentation only)

- Added `docs/LEARNING-MODES.md` and recorded [[DEC-026]], separating Learning Path from Daily Quest and Practice Modes while reusing shared content and learner state.
- Defined the contiguous completion frontier for soft-locked, out-of-order Learning Path completion; Practice Modes, Daily Quest, and Review do not write LessonProgress or unlock curriculum.
- Added target documentation for Topic membership, VocabularyProgress, expected-jamo JamoStats, and DailyQuestProgress with stable daily content and idempotent EXP.
- Documented conservative MVP EXP: Learning Path keeps its existing rule, Daily Quest awards once per quest, and Topic/Position/Random/Review award no EXP.
- No application, domain TypeScript, Firestore, or migration code changed in this documentation pass.

### 2026-09-27 — Identity and content-boundary conventions (documentation only)

- Recorded [[DEC-024]]: document-backed domain IDs equal Firestore document IDs without duplicated stored fields; embedded exercise IDs and `Progress.lessonId` are explicit exceptions.
- Added MVP authoring constraints for Lesson exercises (non-empty, normally 5–12, maximum 20) and the `mistake > low-accuracy > slow` review-reason priority.
- Deferred level-curve balance work while retaining the derived flat EXP formula, so a future formula change requires no migration.
- No application, domain TypeScript, Firestore, or migration code changed in this documentation pass.

### 2026-09-27 — Progress creation, ordering, and profile audit model (documentation only)

- Recorded [[DEC-023]] and updated the target domain model: missing Progress now means locked; Progress documents are created only for the initial unlocked lesson and newly unlocked next lessons.
- Defined the canonical cross-course progression sequence as `Course.order → Unit.order → Lesson.order`, with scoped uniqueness requirements; document IDs do not define order.
- Added target field `UserProfile.updatedAt`, updated only by persisted profile mutations and deliberately separate from any future activity timestamp.
- No application, domain TypeScript, Firestore, or migration code changed in this documentation pass.

### 2026-09-27 — Vocabulary import and Progress-state refinement (documentation only)

- Recorded [[DEC-025]]: vocabulary identity now distinguishes normalized spelling, part of speech, and sense; frequency rank and source provenance are retained before the planned 5,800-word import.
- Added `docs/CREDITS.md` as the required source/license/attribution registry before external content is imported.
- Made lesson meanings nullable according to content type and removed the duplicate persisted `'locked'` Progress state; a missing document is locked.
- Corrected stale references in `DOMAIN-MODEL.md`, `PROGRESS.md`, and DEC-021's historical storage semantics.
- Removed the two remaining target-model references to a persisted three-state Progress status and constrained when the vocabulary `senseKey: 'default'` is valid.
- No application, domain TypeScript, Firestore, or migration code changed in this documentation pass.

### 2026-09-27 — Auth and persistence target architecture (documentation only)

- Added `docs/AUTH-AND-PERSISTENCE.md` as the source of truth for Guest
  lifecycle, IndexedDB persistence, authenticated Firebase persistence,
  UserSession, migration boundaries, and unresolved merge policy.
- Recorded [[DEC-027]], superseding Firebase Anonymous Auth as the target
  model. Existing Anonymous Auth and Firestore-only implementation records are
  explicitly legacy context until separate implementation work replaces them.
- Updated the target UserProfile with `displayName`; removed the obsolete
  `showEnglishKeys` setting because physical English labels are always shown.
- Added planned work for Guest sessions, IndexedDB adapters, account auth, and
  safe migration. No source code, Firebase configuration, Firestore rules, or
  data migration changed in this documentation pass.

### 2026-09-27 — Shared learner-state semantics (documentation only)

- Recorded [[DEC-028]], confirming that VocabularyProgress and JamoStat are
  global per underlying learning target across every learning mode and aggregate
  only submitted session results.
- Added `JamoStat.firstPracticedAt` and clarified its first/latest timestamps
  are based on submitted sessions, not individual persisted keystrokes.
- Added `DailyQuestProgress.completedAt`, separate from `expAwarded`, while
  preserving the `dailyQuestProgress/{dateKey}` path and once-per-day EXP rule.
- Expanded planned work for shared result aggregation, derived Topic/Position
  displays, Daily Quest persistence, and idempotent rewards. No source code,
  Firebase configuration, Firestore rules, adapters, or migrations changed.

### 2026-09-28 — Session and History architecture (documentation only)

- Added `docs/SESSION-AND-HISTORY.md` and recorded [[DEC-029]], separating
  submitted activity history from current learner state and lifetime UserStats.
- Defined one discriminated LearningSession context across Learning Path and all
  practice modes; raw counters and timing derive accuracy/WPM without detailed
  event persistence.
- Defined start-time session IDs, reuse on the same logical-submit retry, new
  IDs for real replays, and logical exactly-once effects across history and
  shared learner-state aggregation. The persistence mechanism remains deferred.
- Added planned domain, repository, local/Firebase persistence, history query,
  and future presentation work. No source code, Firebase configuration,
  Firestore rules, adapters, or migrations changed.

### 2026-09-28 — Guest-to-account migration merge policy

- Recorded [[DEC-030]] and updated `docs/AUTH-AND-PERSISTENCE.md` with the
  accepted field-level merge rules: progress precedence, session-based EXP/raw
  counter aggregation, deterministic ReviewItem union with earlier scheduling,
  Daily Quest union, settings/display-name precedence, best-result maxima, and
  session-ID union.
- Marked the migration conflict-policy decision done in `docs/PROGRESS.md`.
  The concrete exactly-once persistence mechanism remains implementation work.

### 2026-09-28 — Guest-local persistence foundation

- Replaced route-time Firebase Anonymous Auth with a generated local Guest
  session, native IndexedDB adapters for current learner state, and
  session-aware repository composition. Firebase remains the content reader.
- Added the editable `Guest#NNNN` name control on the Course List and updated
  checked-in Firestore rules for unauthenticated content reads only. Rules were
  deployed by the user.
- Added local-adapter, session-composition, and Course List loader regression
  tests. User ran `pnpm test`: 50 test files and 212 tests passed.

### 2026-09-28 — Authenticated session without Guest migration

- Added Email/password and Google popup authentication behind a Firebase Auth
  adapter, with a session manager that selects Firebase learner repositories
  while authenticated and restores the existing Guest session after sign-out.
- Added the Course List sign-in modal and revalidation on auth-state changes.
  A first cloud profile uses a Google display name when available, otherwise
  `Learner`; no Guest data is copied, deleted, or otherwise migrated.
- User verified `pnpm test` (51 files, 214 tests) and `pnpm build` pass. Vite
  warned that a minified chunk exceeds 500 kB; this is a non-blocking
  performance follow-up.

### 2026-09-28 — Agent documentation routing

- Updated `AGENTS.md` and `CLAUDE.md` to remove stale pre-scaffold and
  Anonymous-Auth-as-target guidance, and to route each task to its authoritative
  architecture, model, persistence, learning-mode, session-history, decision,
  requirement, or credit document.

### 2026-09-28 — Lesson and Review session foundation

- Added `LearningSession`, raw session aggregates, immutable legacy-baseline
  compatibility fields, and profile presentation that keeps legacy averages
  separate from session-tracked accuracy/WPM.
- Added a session-ID receipt/checkpoint boundary for Guest IndexedDB and
  authenticated Firestore. Each new Lesson/Review submission writes its history,
  aggregate, progress, and review effects once; same-ID retries return the
  stored outcome, while real replays receive a new ID.
- Wired the ID and raw metrics from the typing store through route actions and
  application use cases. Firebase profile mapping preserves the compatibility
  layer on later profile writes.
- User verified focused tests, full `pnpm test`, `pnpm build`, and `pnpm lint`.

### 2026-09-28 — Automatic Guest-to-account migration

- Added provider-neutral `MigrateGuestDataToAccount` orchestration over narrow
  local-snapshot and Firebase-account migration repositories. The auth action
  captures the pre-auth Guest identity, starts migration after successful
  Email/password or Google authentication, and keeps authentication successful
  if migration must retry.
- Added deterministic Profile, Progress, and ReviewItem merge functions for
  [[DEC-030]]/[[DEC-031]]. Existing Cloud display names and compatibility
  baselines win; session receipts gate aggregate, progress, and review effects
  so retries cannot duplicate a submitted session.
- Added IndexedDB `migrationCheckpoints`, terminal Cloud markers at
  `users/{uid}/migrations/{guestId}`, and owner-only Firestore rules for
  LearningSession history, session receipts, and markers. Guest records are
  retained; cleanup, future-mode records, and history UI remain deferred.
- Preserved the `legacyBaseline` / `sessionAggregate` compatibility layer. A
  Guest migration does not attempt to reconstruct or retire historical totals.
- User reported focused/full tests, `pnpm build`, and `pnpm lint` pass. Rules
  are checked in but require user deployment.

### 2026-09-28 — Firestore content writes locked

- Closed [[DEC-015]] before launch: browser clients can read learning content
  but cannot write `courses`, `units`, or `lessons`, including when signed in.
- Documented that the old client-SDK seed script is not a production content
  administration path; future authoring requires an Admin SDK, Cloud Function,
  or controlled Firebase Console procedure.

### 2026-09-28 — Lesson completion navigation

- Added the first Lesson Result flow control: the existing lesson-completion
  block now sends learners to an unlocked next lesson, or back to its Course
  Map when the completed lesson is the final available lesson.
- The lesson loader resolves the lesson's containing `courseId` through an
  application-layer unit read; no persisted learner state or completion use
  case changed.
- Added router-level UI regression tests for both destinations and a loader
  regression test for the Course Map fallback data.
- Added `Retry` to the completion block. It returns to a freshly mounted
  typing session for the same lesson; the existing store therefore creates a
  new generation and submission ID for the retry attempt.
- Added `Go to Review`, which routes to the existing due-only `/review` queue
  without changing its Leitner scheduling or persistence behavior.
- Added the inline lesson Result summary from the transient `LessonResult`:
  accuracy, WPM, duration, all rejected keystrokes, and unique mistyped words.
  The action response and persisted learner state remain unchanged.

### 2026-09-29 — Light-theme UI consistency

- Unified Course Map, Lesson, Review, Profile, Settings, Auth modal, virtual keyboard, route-error, and not-found screens with Home's warm cream/pastel/rounded presentation language. Added presentation-only primitives under `src/components/ui/`: `PageSurface`, `Card`, `Button`, accessible `Modal`, native-select `Dropdown`, and `SnackbarProvider`.
- Added non-blocking, dismissible snackbar feedback exclusively for Settings saves and authentication/sign-out outcomes. A failed Settings save now returns a structured UI error and skips loader revalidation so the learner remains on the editable form; parsing, repository calls, and Firebase persistence semantics are unchanged.
- Used existing Jamozy assets from `public/templates` for recovery states. Dark mode and animation remain out of scope.
- Fresh review found and the implementation fixed: Settings failed-save revalidation, stale auth notifications, modal Escape/focus behavior, active typing-surface theme coverage, description-list semantics, and result-region accessibility.
- Verification: 248 Vitest tests passed; `pnpm lint` and `pnpm build` passed. Browser visual QA covered Home and Settings.

### 2026-09-29 — Extracted Lesson Result component

- Moved the completed-lesson presentation from `LessonDetailPage.tsx` into `LessonResult.tsx`. `LessonDetailPage` remains the state-flow coordinator and continues to own route navigation, loader/action wiring, and retry setup.
- `LessonResult` receives the transient `LessonCompletion` plus callbacks for Retry, Review, and Continue; it preserves all result metrics, unique review-word handling, and the existing Next Lesson/Course Map decision.
- Added focused component coverage for the result summary and CTA delegation. Verification: 249 Vitest tests and `pnpm lint` passed.

### 2026-09-29 — Profile statistics compatibility

- Changed Profile's Lessons completed source of truth to persisted `LessonProgress.status === 'completed'`, matching Course Map and remaining stable when curriculum adds Units or Lessons. It no longer uses EXP or a session aggregate proxy.
- Updated the Profile read model to combine session exercise/best/time counters with the compatibility baseline and derive accuracy/WPM directly from raw session counters when that baseline is empty. Non-zero legacy averages remain unchanged because their source denominators are unavailable.
- Added regression coverage for raw-session profile metrics and completed-lesson Progress counting. Verification: 252 Vitest tests, lint, and production build passed.

### 2026-09-29 — Learning Path replay reward

- Changed an intentional replay of an already completed Learning Path lesson from 0 EXP to a flat 15 EXP. First completions retain their accuracy-based reward; replays do not change Progress, unlock another lesson, or create first-completion review effects ([[DEC-033]]).
- Added regression coverage for the replay outcome. Verification: 253 Vitest tests, lint, and production build passed.

### 2026-09-29 — Admin BO design and implementation plan

- Recorded the approved single-owner Admin BO design: Google custom-claim authorization, `/admin` routes, Course/Unit/Lesson Draft/Publish/Archive lifecycle, text Exercise authoring, no hard deletion, and published-only learner visibility.
- Added the implementation plan covering content-state migration, Rules Emulator coverage, repository/use-case boundaries, admin UI, and operator rollout. No Admin BO code has been implemented yet.

### 2026-09-29 — Native Admin BO content management

- Implemented the protected `/admin` Course → Unit → Lesson authoring flow in
  the existing React app. It supports Draft/Publish/Archive/Restore, saves
  text-only Exercise arrays, preserves embedded exercise IDs while reordering,
  and transactionally swaps adjacent Unit/Lesson orders.
- Added the separate admin repository/application path and a Firebase custom
  claim adapter. Learner repositories now query only published content and
  reject unpublished direct lookups; Firestore Rules are the authoritative
  guard for owner-only content writes and published ancestor visibility.
- Added `firebase-admin` scripts: `pnpm content:migrate-status -- --dry-run`
  reports legacy statusless content; `--write --after-dry-run` applies only
  `status: 'published'` to Course/Unit/Lesson documents. `pnpm admin:grant -- <uid>`
  assigns the owner claim with a local service credential. Neither script was
  run against Firebase during implementation.
- Recorded [[DEC-034]] and updated README/PROGRESS/DOMAIN-MODEL with the
  required production order: indexes → migration → Rules → owner claim → app.
- Local verification passed: 264 Vitest tests, lint, production build, and
  `git diff --check`. Firestore Rules Emulator coverage and the real Firebase
  rollout remain explicitly pending; no Firebase state was changed.

### 2026-09-29 — Admin BO production rollout

- Deployed the Admin BO Firestore indexes and restrictive Rules.
- Ran the status migration against Firebase: it found and updated 5 legacy
  statusless content documents to `published`.
- Granted the owner `admin: true` custom claim and verified it by successfully
  editing content through `/admin`.
- Firestore Rules Emulator coverage remains follow-up hardening; the deployed
  rollout did not change any learner/user collections.

### 2026-09-29 — Admin BO Firestore Rules Emulator coverage

- Added `pnpm test:rules`, which starts a local Firestore Emulator and runs
  the Rules integration suite without contacting the Firebase project.
- Added coverage that permits only published content with published ancestors
  to anonymous learners, rejects Course/Unit/Lesson writes by authenticated
  learners, and permits an `admin: true` user to read draft content and create
  or update Course/Unit/Lesson content.
- Mutation-verified the learner-write denial: temporarily weakening the Course
  write Rule made the focused suite fail, then the original Rule passed again.

### 2026-09-29 — One-page Learning Path implementation (verification pending)

- Added Home one-page player flow with course-local queues, completed-exercise
  checkpoint plumbing in IndexedDB, and a presented finger-placement guide.
- Refactored Learning Path progress writes toward missing/unlocked/completed
  target semantics and global Course → Unit → Lesson frontier ordering.
- Per user direction, no test, build, or lint command was run in this round;
  verification and content seeding remain user-owned.

### 2026-09-30 — Hangul guide inspection setup

- Bundled Noto Sans KR at weight 700 and wait for each syllable's Korean glyph
  before canvas rendering, making the glyph geometry independent of installed
  system fonts.
- Added the development-only `/dev/hangul-guides` tuner for `녕`, `하`, and
  `죄`. It reuses the production guide operations and pixel assignment path,
  shows original/colored/ownership and exception overlays, reports pixel
  coverage, supports add/subtract rectangle and ellipse operations, and exports
  the edited normalized guide JSON without changing production guide data.
- Tuned those three seed guides to complete single-owner partitions. Browser
  inspection reports 0 unassigned, overlapping, and nearest-center-fallback
  pixels for each target syllable.
- Verified with `pnpm build`, `pnpm lint`, and browser visual QA. No automated
  tests were added per the requested UI-only testing policy.

### 2026-09-30 — Hangul segmentation guide data module

- Moved the guide schema, reusable seed layouts, and `SYLLABLE_GUIDES` map from
  `DecomposedHangulTarget.tsx` into
  `src/features/typing/hangul-segmentation-guides.ts`.
- The learner renderer and development tuner import the same data map. The
  tuned `녕`, `하`, and `죄` values were copied unchanged; no guide behavior was
  changed.

### 2026-09-30 — Pretendard per-jamo SVG PoC

- Added the development-only `/dev/jamo-svg` inspector. It lazy-loads only in
  Vite development mode and does not import, change, or reuse the learner
  canvas renderer or the Hangul guide data.
- The inspector fetches and parses the locally bundled Pretendard 600 TTF with
  `opentype.js`, renders the original font glyph alongside its extracted SVG
  outline, exposes every contour for manual physical-jamo ownership assignment,
  and previews the future combined-path export shape.
- Inspected six source glyphs: `가` (2 contours), `하` (4), `녕` (4), `죄` (3),
  `화` (4), and `값` (4). `가`, `하`, `녕`, `죄`, and `화` group cleanly by
  physical jamo; `값` contour 3 contains both final `ㅂ` and `ㅅ` geometry and
  is explicitly marked as requiring a future split rather than exported as a
  misleading clean grouping.
- Verified with `pnpm build`, `pnpm lint`, and browser inspection of the
  normal SVG extraction and the `값` splitting warning. No automated tests were
  added, per the UI-only PoC testing policy.
- Normalized the inspection previews to Pretendard's 2,048-unit em square and
  derived the SVG baseline (`1,752`) from its ascender (`1,950`) and descender
  (`-494`). The dev-only Original preview can now overlay the extracted outline
  to inspect the shared scale and position without per-syllable offsets.
- Extended only the `/dev/jamo-svg` PoC for `값`: its mixed third source
  contour is displayed alongside two inspectable, independently owned pieces
  for final `ㅂ` and `ㅅ`. Every exterior source command is retained from the
  local Pretendard 600 outline; the splitter introduces only the shared,
  interior vertical closure needed to form two fillable paths.
- The `값` export now contains one ordered combined path for each of `ㄱ`, `ㅏ`,
  `ㅂ`, and `ㅅ`, and reports `requiresPathSplitting: false`. The dev tool also
  provides a one-color source-outline overlay for visual reconstruction checks.
- Per user direction, no build, lint, or automated tests were run for this
  UI-only change; browser visual inspection was used instead.

### 2026-09-30 — Full Pretendard Hangul SVG structural analysis

- Added `docs/research/HANGUL_SVG_ANALYSIS.md`, recording the source-font
  constraints, completed six-syllable PoC findings, full U+AC00–U+D7A3
  measurements, count-signal limitations, and a recommended future tagger
  architecture without implementing it.
- Added the development-only `scripts/analyze-hangul-svg.ts` reproducer. It
  scans all 11,172 modern Hangul syllables directly from the local Pretendard
  600 TTF using the same outline coordinate convention as the SVG PoC and the
  app's existing physical-jamo expansion rules.
- The scan found 3,312 contour/step-count aligned glyphs, 1,715 contour-deficit
  candidates, and 6,145 contour-surplus candidates. These remain review
  signals, not automatic ownership or splitting decisions; the known `값`
  union is count-aligned.

### 2026-09-30 — Verified `하` multi-contour SVG ownership

- Corrected the development-only Pretendard SVG PoC default ownership to
  Contour 1 → `ㅏ` and Contours 2–4 → `ㅎ`.
- Verified the combined `ㅎ` output retains its transparent inner counter under
  `evenodd` fill and reconstructs the source glyph with the separate `ㅏ`
  path. Recorded `하` as a verified multi-contour/counter reference in the
  persistent SVG analysis.

### 2026-09-30 — Jamo SVG Tagger v1 design

- Added `docs/research/JAMO_SVG_TAGGER_DESIGN.md`, a design-only specification
  for the future development Tagger. It defines regenerable extraction cache
  shards, durable version-controlled review metadata, source-command split
  recipes, semantic grouping, bounded review queues, validation, and the
  minimal runtime-data boundary.
- Revised the review persistence design before implementation: committed
  ownership/split records are choseong-sharded from v1 behind a layout-agnostic
  `ReviewStore`, with a versioned manifest, per-shard checksums, safe
  single-shard writes, and a separately versioned queue document. This avoids a
  monolithic-review migration as coverage grows.
- The design intentionally defers implementation, production dataset
  generation, and any production renderer changes.

### 2026-09-30 — Development-only Jamo SVG Tagger v1

- Added the sharded Pretendard 600 extraction cache generator, source-outline
  review compiler/validator, constrained verified `값` split recipe, and
  durable choseong-sharded review/manifest plus separate queue stores.
- Added `/dev/jamo-svg-tagger`, lazy-loaded only in development, with a queue,
  source/contour ownership inspection, ordered colored and monochrome SVG
  previews, source overlay, validation, safe save, and explicit approval.
- Seeded the six verified references into committed review shards and a small,
  explicit representative queue. The generated extraction cache remains
  ignored; no production renderer, learner flow, or runtime SVG data changed.
- Added an unresolved split-review workflow: a reviewer can retain a
  `reviewing` record with a `needs-split` blocker and note, save it without
  inventing invalid contour ownership, and later revisit it through the
  dedicated queue filter. Such records cannot be approved or exported.
- Fixed a Tagger save-render crash: save responses intentionally omit immutable
  source geometry, so the client now retains the currently loaded source glyph
  while applying the returned review state.
- Fixed contour reassignment previews: every dropdown edit now makes a
  non-persisting dev-only preview request that recompiles the current draft and
  refreshes automatic blockers. Out-of-order preview responses cannot overwrite
  a newer draft; saving remains the only operation that writes a review shard.
- Added a compiled physical-step inspection panel to the dev-only Tagger. It
  renders each ordered export path independently, highlights empty steps, and
  exposes ownership controls for the existing constrained split pieces so a
  reviewer can verify paths, combined coloring, and reconstruction before
  human approval.
- Documented Split Workbench v2 before implementation: it covers the six
  manually reviewed split candidates, preserves source-command partitioning,
  removes V1 duplicate split-piece ownership in favor of reviewed-step refs,
  defines a deterministic migration, and records the current note/blocker
  inconsistency without mutating reviewed records.
- Migrated the bounded Pretendard review store to schema V2 and added the
  development-only source-command Split Workbench. Ownership now derives only
  from reviewed-step geometry; reviewers can inspect cached command indexes,
  create/delete source-range pieces, add explicit closure seams, assign pieces
  to steps, and validate live without introducing replacement SVG geometry.
- Added a dev-only command-range inspector for split review: it previews the
  exact source-command replay for a selected piece, supports additional ranges
  and move anchors, and exposes per-command owned/open/duplicate coverage.
- Changed split-piece editing to a jamo-first visual flow: reviewers choose the
  target physical jamo before painting source-command geometry; numeric command
  inputs are now optional technical controls. Range updates normalize reversed
  bounds and preserve seams and additional source ranges.
- Added a clearly labelled draft segmentation preview for incomplete split
  recipes. It renders selected source-command strokes by physical jamo while
  validation blockers remain; only a blocker-free review shows exportable
  filled paths.
- Added live per-jamo pending/assigned ownership in the split contour card and
  per-range removal controls, so reviewers can correct accidental
  source-range tokens without recreating an entire piece.
- Consolidated source-range editing inside each split piece: every range now
  has its own from/to controls and removal action, while the redundant command
  highlight and piece-preview panel was removed to keep the workflow compact.
- Fixed split-range compilation for ranges that begin mid-contour. The compiler
  now restores each range's original cursor with a synthetic move, while
  anchors remain non-owning path controls and cannot create false duplicate
  coverage.
- Made split seams positional: a line-to-anchor can now be inserted between
  consecutive source ranges, removed in place, and keeps the next range in the
  same path instead of forcing a new subpath.
- Clarified manual seam creation in the split UI: it appears directly between
  the two relevant ranges, suggests the command immediately before the next
  range, and keeps existing seams individually removable.
- Made source-range fields ordinary text inputs that update the draft on each
  valid numeric change without number-input spinners or disruptive validation.
