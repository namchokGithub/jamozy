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
