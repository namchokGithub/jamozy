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
- Manual browser verification against the live `jamozy` Firestore: confirmed the empty state at `/` (no due-count badge) and `/review` ("Nothing due right now.") against real data; completed a lesson with a deliberate mistake to create/update a real `ReviewItem` via the already-shipped `create-review-items.ts` path, then confirmed both pages still correctly showed nothing due afterward (a freshly-mistaken item's `nextReviewAt` is 1 day out) — proving the due-filtering logic reads live data faithfully rather than being wired to something that always shows up. Did not hand-edit `nextReviewAt` in the Firebase console to fabricate a due item for a full "Start Review → type → summary" live walkthrough — that would cross CLAUDE.md's Firebase Caution line; that flow is instead exercised end-to-end by the Vitest suite against fakes.
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
