# Decision Log

Architecture and product decisions for Jamozy, in chronological order. Each entry: what was decided, why, and alternatives considered (if any). Add new entries at the bottom.

Status values: `Accepted`, `Superseded by DEC-00X`, `Rejected`.

---

## DEC-001 — Firebase Anonymous Auth for identity, no traditional sign-up

**Date:** 2026-09-23
**Status:** Accepted

**Decision:** Use Firebase Anonymous Authentication to identify learners for the MVP instead of email/password or social sign-up.

**Why:** Removes friction for a casual, single-player typing-practice app. Learners can start practicing immediately without account creation. Cloud profile sync / Google account linking is deferred to a later phase (see README "Later" list).

**Consequences:** User data is tied to a device-local anonymous UID until linking is added. Losing local auth state loses progress access until account linking ships.

---

## DEC-002 — Layered architecture: domain / application / infrastructure / features

**Date:** 2026-09-23
**Status:** Accepted

**Decision:** Structure `src/` as `domain` (models + repository interfaces) → `application` (use cases) → `infrastructure/firebase` (concrete repositories, mappers) → `features` (UI), with dependencies only pointing downward.

**Why:** Keeps Firebase out of React components, makes use cases testable without a live Firestore connection, and keeps learning content and user progress cleanly separated at the repository boundary.

**Consequences:** More files/boilerplate per feature than a flat structure. Accepted as a deliberate tradeoff for testability and swappable persistence.

---

## DEC-003 — Keystroke-level state stays client-side; Firestore writes only at checkpoints

**Date:** 2026-09-23
**Status:** Accepted

**Decision:** Typing-session state (current keystroke, in-progress accuracy) lives in Zustand only. Firestore is written to only at meaningful checkpoints (lesson complete, session end), not per keystroke.

**Why:** Avoids excessive Firestore write costs/rate limits and keeps typing feedback latency independent of network round-trips.

**Consequences:** In-progress lesson state is lost on hard refresh/crash before a checkpoint. Acceptable for MVP; no mid-lesson resume requirement.

---

## DEC-004 — MVP excludes multiplayer, leaderboards, and social/competitive features

**Date:** 2026-09-23
**Status:** Accepted

**Decision:** No multiplayer, leaderboards, or social features in the initial scope.

**Why:** Keeps the first version focused on the core solo learning loop (Learn → Type → Review → Improve → Unlock) and matches the calm, non-competitive theme direction.

**Consequences:** Re-evaluate post-MVP; tracked under README "Later" (achievements, daily streaks).

---

## DEC-005 — Pin `@vitejs/plugin-react` to 5.2.0, not latest

**Date:** 2026-09-23
**Status:** Accepted

**Decision:** Pin `@vitejs/plugin-react` to `5.2.0` instead of the latest `6.x`.

**Why:** README pins Vite to major version 7. `@vitejs/plugin-react@6.x` requires Vite 8 as a peer (`vite: ^8.0.0`) and fails the build with `ERR_PACKAGE_PATH_NOT_EXPORTED` against Vite 7. `5.2.0` is the newest version whose peer range still includes `^7.0.0`.

**Consequences:** Revisit this pin if/when the project intentionally upgrades to Vite 8 (would need its own decision entry — Vite major bumps can affect other tooling).

---

## DEC-006 — Level is derived from EXP, never stored

**Date:** 2026-09-23
**Status:** Accepted

**Decision:** `UserProfile.level` is not a stored field. It's computed from `exp` via `level = 1 + floor(exp / 100)`.

**Why:** User chose "derived" over "stored" to resolve the open question in `docs/DOMAIN-MODEL.md`. A derived value can't drift from its source, and the leveling curve can be tuned later without a data migration — only `exp` is ever written.

**Consequences:** The exact formula (`100` EXP per level) is an MVP placeholder, not confirmed game-design balance. Lives as `levelFromExp()` in `domain/models/user-profile.ts` — change it there, not in UI code.

**Reaffirmed 2026-09-23:** cross-checked against `docs/requirement.md`, whose own example ("Level 7, 430/600 EXP") implies an increasing per-level curve and separately lists "Level" as a thing to save. User re-confirmed this decision stands as-is over that example.

**Deferred 2026-09-27 ([[DEC-024]]):** retain the flat 100-EXP curve until later game-balance work has real learning-volume and EXP-rate data. This is deliberately not a schema change: `level` remains derived from the only persisted value, `exp`.

---

## DEC-007 — Settings live as a field on the user doc

**Date:** 2026-09-23
**Status:** Accepted

**Decision:** `UserSettings` is an embedded field on `users/{userId}`, not a separate `users/{userId}/settings/{settingsId}` subcollection.

**Why:** User's explicit choice. Settings are read on most screens (sound, keyboard hint); keeping them on the already-fetched user doc avoids an extra read per screen.

**Consequences:** Any settings write touches the whole user doc — acceptable given how small/infrequent settings writes are expected to be.

---

## DEC-008 — Spaced repetition (Leitner boxes) for review scheduling

**Date:** 2026-09-23
**Status:** Accepted

**Decision:** `ReviewItem` review scheduling uses a Leitner-box system: `box` (1–5) + `nextReviewAt`. Box→interval: 1→1 day, 2→3 days, 3→7 days, 4→14 days, 5→30 days. Correct review advances the box (capped at 5); a mistake resets it to 1.

**Why:** User chose spaced repetition over a flat unresolved-item list, matching README's "Review mistyped words" feature. Leitner boxes are the simplest spaced-repetition scheme to implement and reason about for MVP.

**Consequences:** Adds `box`/`nextReviewAt` fields to `ReviewItem` (see `docs/DOMAIN-MODEL.md`). The interval table is an MVP placeholder — tunable later without a schema change.

**Reaffirmed 2026-09-23:** cross-checked against `docs/requirement.md`, which says MVP doesn't need "full" spaced repetition (just a flat problem-word list). User re-confirmed this decision stands.

---

## DEC-009 — Sequential unlock: previous lesson completed unlocks the next

**Date:** 2026-09-23
**Status:** Accepted (creation/ordering details superseded by DEC-023; Progress-state shape superseded by DEC-025)

**Decision:** A lesson's `Progress.status` moves from `'locked'` to `'unlocked'` when the previous lesson (by `Lesson.order`, carrying across `Unit`/`Course` boundaries) reaches `status === 'completed'`. No accuracy threshold gates unlocking. The first lesson overall is unlocked by default (seed data, not derived).

**Why:** User's explicit choice — simplest rule matching the README's linear Learn → Unlock flow. No separate "unlock accuracy" product requirement exists yet.

**Consequences:** This transition is written by the `complete-lesson` application use case (sets the next lesson's `Progress.status`), not computed on read — keeps read paths simple at the cost of a slightly more involved write.

**Reaffirmed 2026-09-23:** cross-checked against `docs/requirement.md`'s 4-state (`Locked/Ready/Completed/Mastered`) suggestion. At that time the user retained `locked/unlocked/completed`; [[DEC-025]] later superseded that persisted-state shape with missing/unlocked/completed, while still leaving no `Mastered` trigger.

---

## DEC-010 — `LessonExercise` gains `difficulty` and split Thai/English `meaning`

**Date:** 2026-09-23
**Status:** Accepted (meaning nullability superseded by DEC-025)

**Decision:** `LessonExercise` adds `difficulty: 'easy' | 'medium' | 'hard'`, `meaningTh: string`, `meaningEn: string`. The existing `hint` field stays for non-meaning extras (e.g. keyboard tips), no longer doubles as "meaning."

**Why:** `docs/requirement.md`'s Vocabulary section (#3) stores Korean/Romanization/Thai-English-meaning/Difficulty/Lesson per word. Practice Mode (#6) filters by difficulty. Settings (#13) lets the learner pick meaning language (Thai/English/Both) — a single opaque `hint` string can't serve a language toggle.

**Consequences:** `meaningTh`/`meaningEn` nullability is superseded by [[DEC-025]]. `difficulty` is a 3-tier MVP placeholder; widening the union later is not a breaking schema change.

---

## DEC-011 — `UserStats` added as an embedded entity on `UserProfile`

**Date:** 2026-09-23
**Status:** Accepted (field shape superseded by DEC-022)

**Decision:** `UserStats` is embedded as `UserProfile.stats`. Its original field shape was superseded by [[DEC-022]]; `currentLevel` remains excluded — it's `levelFromExp(exp)`, computed on read ([[DEC-006]]).

**Why:** `docs/requirement.md`'s Stats (#9) and Save System (#14) sections want these aggregate numbers persisted; no entity for them existed before this pass.

**Consequences:** Embedded on the user doc (same reasoning as [[DEC-007]] for settings — one read covers profile/settings/stats together). These counters need to be updated by whichever `application/` use case completes a lesson or a review attempt — not yet wired, since `application/` doesn't exist yet.

---

## DEC-012 — `ReviewItem.reason` field added

**Date:** 2026-09-23
**Status:** Accepted

**Decision:** `ReviewItem` adds `reason: 'mistake' | 'slow' | 'low-accuracy'`.

**Why:** `docs/requirement.md`'s Review System (#5) wants words entering review for three reasons — mistyped, took long, or low accuracy — not just mistakes. The prior model only had `mistakeCount`, implicitly mistake-only.

**Consequences:** `mistakeCount`/`lastMistakeAt` are kept as-is (still meaningful for `reason: 'mistake'` items); for `'slow'`/`'low-accuracy'` items they're less central but not removed, to avoid a second near-duplicate shape. Revisit if that turns out awkward once `application/` use cases actually create these items.

---

## DEC-013 — `UserSettings` expanded to the full requirement.md list

**Date:** 2026-09-23
**Status:** Accepted

**Decision:** `UserSettings` becomes `soundEnabled`, `showKeyboard`, `showEnglishKeys`, `keyboardOpacity`, `romanizationEnabled`, `meaningLanguage: 'th' | 'en' | 'both'`, `theme: 'light' | 'dark'` — replacing the earlier single `keyboardLayoutHint` boolean.

**Why:** `docs/requirement.md` #13 (plus keyboard opacity from #10) lists 7 distinct settings; the placeholder 2-field version predated that spec. "Reset Progress" (also in #13) is excluded — it's an action/use case, not persisted state.

**Consequences:** `keyboardLayoutHint` is removed, not deprecated-and-kept — no data exists yet to migrate (Firestore database has no seeded user docs). If that changes before this ships, revisit as a real migration.

---

## DEC-014 — Application-layer additions found necessary while building the use cases

**Date:** 2026-09-23
**Status:** Accepted

**Decision:** Building the 5 `application/` use cases from README's list surfaced 4 things not previously decided:

1. **`UserProfileRepository`** (`domain/repositories/user-profile-repository.ts` + `FirebaseUserProfileRepository`) — not in README's original repository file list, but `complete-lesson` needs to read/write `UserProfile.exp`/`stats`. Same shape as the other repositories (`getUserProfile`, `saveUserProfile`).
2. **`CourseRepository.getUnitById(unitId)`** — added alongside `getUnitsByCourseId`. Needed to walk unit → course → next unit when unlocking the first lesson of the next unit ([[DEC-009]]'s cross-boundary case).
3. **`submit-review-result.ts`** (6th `application/` file, beyond README's 5) — advances a `ReviewItem`'s `box`/`nextReviewAt` via `nextBox`/`nextReviewDate` ([[DEC-008]]). Without it, `ReviewRepository.updateReviewItem` had no caller and spaced repetition couldn't actually progress. `resolved` was later removed from the target model by [[DEC-022]].
4. **No repeat EXP/unlock on lesson retry** — `complete-lesson` checks whether the lesson was already `'completed'` before this call; if so, it still records the attempt (via `update-progress`) but skips awarding EXP and re-unlocking the next lesson. Not specified anywhere; chosen to avoid EXP farming via repeated retries.

**Why:** These are mechanical necessities to make already-decided behavior ([[DEC-008]], [[DEC-009]], [[DEC-006]]/[[DEC-011]] EXP+stats) actually executable, not new product scope.

**Consequences:** `application/complete-lesson.ts` is the most complex use case (reads/writes across 4 repositories). `application/get-review-items.ts` filters `ReviewRepository.getReviewItems()` client-side rather than a server-side query — fine at MVP scale, revisit if a user's review list grows large.

---

## DEC-015 — Firestore rules: any signed-in user can write content (MVP-only)

**Date:** 2026-09-23
**Status:** Accepted (temporary — must revisit before shipping)

**Decision:** Added `firestore.rules` (+ `firebase.json`, `.firebaserc`). `courses`/`units`/`lessons` are readable AND writable by any signed-in user (including Anonymous Auth). `users/{userId}` and its subcollections are readable/writable only by that same `uid`.

**Why:** `pnpm seed` (client SDK) failed with `PERMISSION_DENIED` — the Firestore database had no rules deployed yet (default deny-all). There's no admin/content-management auth tier built yet (`docs/requirement.md` #15, "Content Management," isn't implemented), and the seed script authenticates the same way any player would (Anonymous Auth). User chose to unblock seeding this way rather than switch to an Admin SDK + service account.

**Consequences — real security gap, not just theoretical:** any signed-in player can currently rewrite `courses`/`units`/`lessons` from the browser console via the Firestore client SDK (vandalize curriculum content, not just their own progress). Acceptable for local MVP development with no real users. **Must be replaced before any public launch** — either a custom-claims admin role, or move content writes to an Admin SDK/Cloud Function path and lock `courses`/`units`/`lessons` to `allow write: if false` for clients. User data rules (`users/{userId}/**`) are already correct/production-safe as written.

**Deploy:** rules aren't live until run — `firebase login` (interactive, user runs this) then `firebase deploy --only firestore:rules`.

---

## DEC-016 — Composite Firestore indexes, and `ensureUser` injected into loaders (not imported)

**Date:** 2026-09-23
**Status:** Accepted

**Decision:** Two related fixes found via manual browser testing of the first UI feature (`docs/superpowers/plans/2026-09-23-course-lesson-ui.md`), both confirmed by a fresh whole-branch code review:

1. **`firestore.indexes.json`** added (+ wired into `firebase.json`). `FirebaseCourseRepository.getUnitsByCourseId` and `FirebaseLessonRepository.getLessonsByUnitId` combine a `where()` equality filter with `orderBy()` on a different field — Firestore requires a composite index for that query shape. Two indexes: `units` (`courseId` + `order`), `lessons` (`unitId` + `order`).
2. **`ensureUser: () => Promise<{ uid: string }>`** is now an injected dependency on every route loader (`CourseListPage.loader.ts`, `CourseMapPage.loader.ts`, `LessonDetailPage.loader.ts`), bound once in `src/app/router.ts` to `signInAnonymouslyIfNeeded` (`src/infrastructure/firebase/firebase.ts`). No file under `src/features/` imports `infrastructure/firebase` directly anymore.

**Why:** (1) `firestore.rules` ([[DEC-015]]) requires `request.auth != null` for reading `courses`/`units`/`lessons` at all, not just per-user data — but only `CourseMapPage.loader.ts` originally called `signInAnonymouslyIfNeeded()`, so `CourseListPage`/`LessonDetailPage` hit `PERMISSION_DENIED` in the browser. The fix (adding the call) worked, but duplicated the precondition into every loader with no test, and each loader importing `infrastructure/firebase/firebase` directly violates `AGENTS.md`'s layering rule ("never through `infrastructure/firebase` directly from `features/`") — the original plan itself sanctioned that import, so this was a plan defect, not an implementer mistake. (2) The composite-index error only surfaces against real Firestore — none of the fakes-based unit tests model Firestore's index requirements, so nothing caught it before the browser.

**Consequences:** Every loader now takes `ensureUser` as a constructor-style dependency and has a unit test (`*.loader.test.ts`) asserting it's called before any repository read — the exact bug class that broke in the browser is now pinned by a fast, no-network test, not just "eyeball it, low risk" as the original spec assumed. `NotFoundError` (`src/domain/errors.ts`) was added alongside this fix so `RouteError` can show "Not found." instead of a raw error message for a missing course/lesson — same review pass, same root cause category (spec under-tested the loader layer). **Deploy:** `firebase deploy --only firestore:indexes` (in addition to `firestore:rules`) is required before the course map works in any environment, including a fresh `firebase use` on another machine.

---

## DEC-017 — Korean typing engine: own 2-beolsik composition, not the OS IME; jamo-level blocking; progressive partial-compound display

**Date:** 2026-09-24
**Status:** Accepted

**Decision:** Built the core Korean typing engine (`src/domain/korean/{keymap,hangul,target-sequence,typing-session}.ts` + `src/features/typing/session-store.ts`, first use of Zustand in this codebase) as a framework-free subsystem that interprets raw `KeyboardEvent.code` (physical key, not `.key`) through a standard 2-beolsik layout, rather than relying on the browser/OS Korean IME. Matching happens at jamo level: a wrong key is rejected (counted as a mistake, never mutates composed text or advances) — the learner must enter the correct next jamo to proceed. Since every exercise's target text is known in advance, the whole expected-keystroke sequence is precompiled once (`target-sequence.ts`), avoiding the ambiguity/backtracking a general-purpose Korean IME needs.

**Why:** `README.md`'s stated purpose is teaching the Korean keyboard layout itself, and `docs/requirement.md` #10 wants the UI to eventually highlight the next physical key (and Shift) to press — only possible if the app controls physical-key interpretation itself; an OS IME only ever exposes already-composed text. Full design reasoning in `docs/superpowers/specs/2026-09-23-korean-typing-engine-design.md`.

**Domain data (2-beolsik keymap, the 19/21/28 Unicode jamo lists, the 7 compound-jungseong and 11 compound-jongseong tables) was independently verified** during the final review — cross-checked against the browser's own Unicode NFD decomposition for all 11,172 precomposed Hangul syllables, KS X 5002, and Unicode conjoining-jamo codepoints. No domain-data errors found.

**Two behaviors changed from the original plan/spec during the post-implementation review, both confirmed by an actual reproducing test before the fix:**

1. **Shift state is only checked strictly on keys that have a Shift variant** (`ExpectedKey.strictShift`, `target-sequence.ts`). A learner still holding Shift from a tense-consonant keystroke while typing the next (non-shifted) jamo — e.g. Shift+K for ㅏ — was being counted as a mistake even though a real 2-beolsik keyboard produces the same character either way. Bare modifier keydowns (e.g. `code: 'ShiftLeft'` firing on its own, as a future UI forwarding raw `keydown` events would do) are now ignored by `pressKey` rather than counted as wrong keys.
2. **A half-typed compound jungseong/jongseong now composes progressively** instead of showing no visible change. The plan's own Review Focus #3 originally specified "no partial final consonant shown" for a half-typed compound jongseong (e.g. show 가, not 갑, after just the ㅂ of ㅄ) — reviewed and **superseded**: the first key of every 2-key compound (jungseong: ㅗ/ㅜ/ㅡ; jongseong: ㄱ/ㄴ/ㄹ/ㅂ) is independently a complete, valid jamo in that slot, so composing with it shows a real, valid intermediate syllable (갑, 호), not a "broken glyph." A correct keystroke that produces no visible change was judged more confusing to a learner than the inconsistency of fixing this for jungseong only, so both were fixed together.

**Consequences:** `pressKey`'s Shift-matching and modifier-handling behavior, and `getComposedText`'s progressive-partial-compose behavior, are both now pinned by unit tests (`typing-session.test.ts`) rather than left to the original "eyeball it" assumption. No UI, lesson-exercise sequencing, aggregate lesson metrics, or `complete-lesson` wiring exist yet — deliberately out of scope for this round (see the spec's Scope section); that's the next integration pass.

---

## DEC-018 — Lesson typing session: accuracy scale boundary, deterministic `ReviewItem` id, and a store `generation` counter to survive React StrictMode

**Date:** 2026-09-24
**Status:** Accepted

**Decision:** Wired the Korean typing engine ([[DEC-017]]) into an interactive "Start Lesson" flow (`src/domain/korean/lesson-session.ts`, `src/features/lesson/LessonTypingSession.tsx`, `src/features/lesson/LessonDetailPage.action.ts`). Three non-obvious choices from this pass:

1. **Accuracy is converted from a 0–1 fraction to a 0–100 scale at the `lesson-session.ts` boundary.** `typing-session.ts`'s own `getAccuracy()` returns 0–1 (an internal, per-exercise concern, left unchanged), but `application/complete-lesson.ts`'s `calculateExpGained` (`accuracy > 90`, `accuracy === 100`) and every other accuracy field in the app (`Progress.bestAccuracy`, `UserStats.averageAccuracy`) are 0–100. `lesson-session.ts`'s `getLessonResult()` does the ×100 conversion once, so nothing downstream needs to know the engine's internal scale differs.
2. **`ReviewItem.id` was set to `LessonExercise.id` (deterministic), not a generated id.** This avoided a client-side scan but assumed exercise IDs were unique across the whole app. This identity rule is superseded by [[DEC-022]]: vocabulary-backed items use `vocabularyId`, while non-vocabulary items use `${lessonId}:${exerciseId}`.
3. **`lesson-session-store.ts` (Zustand) exposes a `generation` counter, incremented on every `start()` call and untouched by `pressKey()`.** `LessonTypingSession` needs to know whether the store's current `session` belongs to *this* mount or is a previous lesson's leftover (the store is a module-level singleton, so nothing resets it between lessons). A first attempt used a one-shot ref flag to skip exactly the render where `start()` was first called — this passed every Vitest test, but still broke live in the browser: `src/main.tsx` wraps the app in `<StrictMode>`, whose dev-mode double-invoke of mount effects consumes a one-shot flag on its thrown-away first pass, leaving the kept second pass to read the stale session and submit it. The `generation` counter fixes this by tracking identity rather than a run count — the submit effect only fires once the store's live `generation` equals the value this mount's own `start()` call returned, which holds regardless of how many times StrictMode re-invokes the effects. `LessonTypingSession.test.tsx` now renders through `<StrictMode>` (matching `main.tsx`) specifically so this class of bug is caught by the unit suite, not only by manual browser testing.

**Why:** All three surfaced only when checking this pass's code against surrounding, already-established contracts (the rest of the app's accuracy scale, `DOMAIN-MODEL.md`'s existing id note, and the app's actual render tree) rather than treating this feature as an isolated unit — the kind of integration detail a fresh whole-branch review is specifically for. Full details, including the exact repro, in `.superpowers/sdd/2026-09-24-lesson-typing-session/progress.md`.

**Consequences:** Any future code that computes accuracy must go through `getLessonResult()` (or otherwise multiply by 100), not read `typing-session.ts`'s internal fraction directly. The `ReviewItem` identity consequence in point 2 is superseded by [[DEC-022]]. Any future Zustand store shared across mounted components with StrictMode active should default to an identity/generation check rather than a one-shot ref flag when gating "did *my* mount's own action already take effect."

---

## DEC-019 — Review system: unbounded due-count default, strict per-item correctness, no same-session requeue, and reusing the `generation` counter for a second store consumer

**Date:** 2026-09-24
**Status:** Accepted

**Decision:** Built the Review System UI (`/review`: `ReviewPage.tsx`, `ReviewTypingSession.tsx`, `application/submit-review-session.ts`) on top of the already-existing `get-review-items.ts`/`submit-review-result.ts` use cases, reusing `lesson-session.ts`/`useLessonSessionStore`/`VirtualKeyboard.tsx` as-is. Four non-obvious choices from this pass:

1. **`getDueReviewItems` gains a `limit` parameter that defaults to `Infinity`, not to the 20-item session cap.** `CourseListPage`'s "N words due for review" badge calls it with no `limit` (the true count); only the `/review` route's own loader passes `limit: 20`. Defaulting to 20 instead would have silently under-reported the badge once a learner has more than 20 items due — caught during the spec's own self-review, before implementation, not by the later code review.
2. **`wasCorrect` for a review item is `mistakes.length === 0` — stricter than "did it eventually finish."** The typing engine's jamo-level blocking ([[DEC-017]]) means every item is eventually typed correctly regardless of how many wrong keys preceded it; a single rejected keystroke anywhere still resets that item's Leitner box to 1, exactly the same "any mistake is a mistake" rule already used when a lesson mistake first creates a `ReviewItem` ([[DEC-018]]).
3. **No same-session requeue of a wrong item (single linear pass, Anki-style requeue explicitly rejected).** A wrong item's box resets and it becomes due again in a future session, never immediately in this one — matches `lesson-session.ts`'s existing single-pass sequencing with zero new domain logic, at the cost of not letting a learner "fix" a mistake within the same sitting.
4. **`ReviewTypingSession.tsx` reuses `lesson-session-store.ts`'s `generation` counter** ([[DEC-018]], point 3) rather than re-deriving its own cross-mount-staleness guard. This is the store's *second* consumer, and the fresh review that closed out DEC-018 explicitly asked this round to verify the reuse — it renders through `<StrictMode>` in its own test file for the same reason `LessonTypingSession.test.tsx` does, and a mutation-testing pass during this round's review confirmed swapping the `generation` check back to the earlier one-shot-ref approach makes the StrictMode-specific test fail again.

**Why:** All four are integration details this feature's own spec surfaced against the app's existing contracts (the badge vs. session-size distinction, the engine's blocking behavior, the existing sequencing logic, and the shared store's known failure mode) rather than choices specific to review in isolation.

**Consequences:** Any future caller of `getDueReviewItems` for a "how many are due" display must call it with no `limit` (or an explicit large one), never assume the 20-item default a session view would want. Any future consumer of `useLessonSessionStore` must key its own submit/completion effect on `generation`, not a one-shot ref, and should render its tests through `<StrictMode>` to prove it — this is now proven to matter across two independent consumers, not a one-off fix.

---

## DEC-020 — Settings UI: shared `defaultUserProfile`, and two fetcher/equality pitfalls that only manual browser testing caught

**Date:** 2026-09-24
**Status:** Accepted

**Decision:** Built `/settings` (`SettingsPage.tsx` + loader/action, `get-settings.ts`/`update-settings.ts`) as a persist-only form on top of `UserProfile.settings` — none of the 7 settings affect any other screen yet, deliberately deferred. `defaultUserProfile(userId, now)` moved from a private helper inside `complete-lesson.ts` to an exported function in `domain/models/user-profile.ts`, reused by both; `complete-lesson.test.ts` was left unmodified and still passes, proving the move changed nothing about lesson completion.

**Two bugs surfaced only by manually driving the page against live Firestore, not by any unit test written before that point:**

1. **A successful React Router action revalidates the route's own loader, so `useFetcher().state` passes through `submitting → loading → idle`, not `submitting → idle`.** A first implementation of the Save button's "Saved" indicator tracked only "was submitting" via a ref; that ref got reset to `false` during the `loading` (revalidation) phase, so it never reached the `idle` check and "Saved" never appeared. Fixed by tracking "was in flight" (`fetcher.state !== 'idle'`) instead of specifically `'submitting'`. The regression test drives a controlled, multi-phase loader/action (not a single resolved promise) so `loading` is forced to be its own observed render — a fast-resolving fake can let React batch `loading` and `idle` together and hide this class of bug, the same lesson [[DEC-018]] already drew from `<StrictMode>`'s double-invoke, but from a different mechanism (a real intermediate lifecycle phase, not a dev-only double-render).
2. **Comparing two structurally-identical objects with `JSON.stringify` breaks when their keys were inserted in a different order.** The "has anything changed since the last save" check was `JSON.stringify(settings) === JSON.stringify(savedSnapshot)`. `settings` is built by spreading the loader's Firestore-sourced object (whatever field order the repository mapper happens to produce); `savedSnapshot` comes from the action's `userSettingsSchema.parse(...)` return value, which Zod always emits in the schema's own field-definition order. Both held byte-identical values with different key insertion order, so `JSON.stringify` treated them as different and "Saved" silently never rendered against real data — even after fixing bug 1. Neither the unit tests (which happened to construct both sides through the same helper, coincidentally matching key order) nor the fetcher-state fix caught this; it was found by injecting a state dump into the live page and diffing the two objects' actual `JSON.stringify` output side by side. Fixed by replacing the whole-object comparison with explicit field-by-field equality across `UserSettings`'s 7 known fields — exact and cheap, since every field is a primitive.

**Why:** Both are integration details invisible from either function in isolation — they only exist at the seam between two different code paths (loader-read vs. Zod-parsed-write) producing objects that are semantically but not syntactically identical. A fresh whole-branch review independently re-derived both fixes' correctness by reverting each one and confirming its own regression test fails, and grepped the rest of `src/` confirming no other `JSON.stringify`-based equality check exists in shipped code.

**Consequences:** Any future "did this change" check in this codebase must compare fields explicitly (or a stable/key-sorted serialization), never a raw `JSON.stringify` of two objects that could have originated from different code paths. Any future `useFetcher()`-driven UI feedback (a "Saved"/"Done" style indicator, not just a submit guard) must account for the `loading` revalidation phase, not just `submitting`, whenever the route also has a loader.

## DEC-021 — Profile Dashboard: display-only rounding of running-average stats

**Date:** 2026-09-25
**Status:** Accepted

**Decision:** `/profile` (`ProfilePage.tsx`, `application/get-profile-summary.ts`) shows level, an EXP progress bar, and all 6 `UserStats` fields, mirroring `get-settings.ts`'s read-only/default-fallback/never-write shape. `averageAccuracy`, `bestAccuracy`, and `averageSpeedWpm` are `Math.round()`ed at render time only — the stored `UserStats` values (running averages from `complete-lesson.ts`, essentially never whole numbers) are never mutated or re-persisted.

**Why:** A fresh whole-branch review caught that the first implementation rendered these fields verbatim (e.g. `98.68421052631578%`), because every test fixture up to that point used tidy hand-picked numbers (`91.5`, `22`) that happened to look fine unrounded. Live verification against real Firestore data surfaced the actual long-decimal output, which the review then traced to the missing rounding step. The fix rounds only in the JSX, not in `get-profile-summary.ts` or anywhere in the domain/application layers — the underlying precision stays intact for any future consumer (e.g. an analytics export) that might want it.

**Consequences:** Any future UI that displays a running-average or other float-valued stat (accuracy, WPM, or similar) should round at the display boundary the same way, and its tests should include at least one realistic non-round fixture (not just tidy numbers) to catch this class of bug before a live check has to.

**Superseded in part by [[DEC-022]]:** `averageAccuracy` and `averageSpeedWpm` are no longer persisted running averages; they are derived from raw counters. The display-rounding rule continues to apply to those derived values.

---

## DEC-022 — Vocabulary-backed review identity and raw aggregate typing counters

**Date:** 2026-09-27
**Status:** Accepted

**Decision:** Add reusable `VocabularyEntry` content at `vocabulary/{vocabularyId}`. A `LessonExercise` may reference it with `vocabularyId`; lesson content remains self-contained and other exercise types do not require a vocabulary entry. A vocabulary-backed `ReviewItem` uses `vocabularyId` as its document ID, combining review history across lessons. A non-vocabulary item uses `${sourceLessonId}:${sourceExerciseId}`.

`ReviewItem.resolved` is removed. Leitner scheduling alone governs the lifecycle: correct answers advance the box and reschedule; mistakes reset it to box 1 and reschedule; box 5 remains active.

Replace `UserStats.wordsPracticed`, `averageAccuracy`, and `averageSpeedWpm` with `exercisesAttempted`, `totalAcceptedKeystrokes`, and `totalRejectedKeystrokes`. Keep `lessonsCompleted`, `bestAccuracy`, and `totalTypingTimeSeconds`. Derive accuracy from accepted/rejected keystrokes and WPM from accepted keystrokes and total typing duration using the existing five-keystrokes-per-word convention. Increment these counters only when a lesson, practice, or review session is submitted; retries count as practice activity but do not increment `lessonsCompleted`.

**Why:** `resolved` removed items from a Leitner schedule after one correct answer. Exercise-local IDs could not safely identify an item globally and could not combine a repeated word's history. Stored averages cannot remain correct without their raw denominators; `wordsPracticed` was inaccurate for characters, phrases, sentences, and retries.

**Consequences:** [[DEC-011]]'s original stats field shape and [[DEC-018]]'s exercise-ID review identity are superseded. Existing code and persisted documents still use the old shape and require a separate implementation/migration change; this decision changes documentation only.

---

## DEC-023 — Lazy Progress creation, canonical progression ordering, and profile update timestamp

**Date:** 2026-09-27
**Status:** Accepted

**Decision:** `users/{userId}/lessonProgress/{lessonId}` documents are created lazily. Their absence means the lesson is locked. Profile creation persists the global first lesson as `unlocked`; completing a lesson persists the next lesson as `unlocked` only when that document does not exist.

The canonical progression order is `(Course.order, Unit.order, Lesson.order)`. `Course.order` is globally unique; `Unit.order` is unique within a course; `Lesson.order` is unique within a unit. The next lesson is the next element in that flattened sequence, including across Unit and Course boundaries. IDs do not supply ordering.

Add `UserProfile.updatedAt`. It equals `createdAt` on initial creation and changes for every persisted profile mutation, including settings, EXP, and stats writes. It does not change on reads or sign-in alone.

**Why:** Precreating locked Progress documents adds writes and makes newly added curriculum awkward. Defining a single cross-boundary ordering removes ambiguity about which lesson unlocks next. `updatedAt` provides an audit/synchronization timestamp without overloading a future activity metric.

**Consequences:** [[DEC-009]] retains the rule that completion unlocks the next lesson, while this decision replaces its seed-based creation detail with lazy creation and makes ordering constraints explicit. Existing code and persisted documents require a separate implementation/migration change; this decision changes documentation only.

---

## DEC-024 — ID conventions, bounded lessons, deterministic review reasons, and deferred level balancing

**Date:** 2026-09-27
**Status:** Accepted

**Decision:** Document-backed domain `id` values equal their Firestore document IDs and are not duplicated in document data. Embedded `LessonExercise.id` is stored in its parent document. `Progress.lessonId` is the sole exception: it is both the Progress document ID and a stored Lesson foreign key. All relationships are string IDs, not Firestore `DocumentReference`s.

`Lesson.exercises` is a non-empty, ordered array. MVP content should normally have 5–12 exercises and cannot exceed 20; authors split larger content into another lesson. If a submitted exercise qualifies for several review triggers, `ReviewItem.reason` chooses `mistake` over `low-accuracy` over `slow`; that creation reason is retained on later triggers.

The flat EXP curve remains in place and is deferred for future game-balance work. No level field is persisted, so a later curve change requires no data migration.

**Why:** Explicit identity rules prevent accidental duplication of document IDs or misuse of embedded IDs. A bounded exercise count preserves a focused lesson session. A deterministic reason preserves one meaningful value when trigger rules overlap. Deferring the level curve avoids speculative balance work before there is real learning data.

**Consequences:** Content validation must enforce the exercise constraint before writing a Lesson. Review-creation code must evaluate all applicable triggers with the documented priority. Existing code and persisted documents require separate implementation/migration changes where they differ; this decision changes documentation only.

---

## DEC-025 — Vocabulary import identity and nullable meanings; simplify persisted Progress states

**Date:** 2026-09-27
**Status:** Accepted

**Decision:** A `VocabularyEntry` is unique by normalized Korean spelling, part of speech, and a required `senseKey`. Identical spelling may therefore have multiple entries. Use `senseKey: 'default'` only when a spelling/POS pair has a single imported sense; multiple senses under that pair must use distinct stable sense keys. Vocabulary adds `partOfSpeech`, `senseKey`, `frequencyRank`, `sourceId`, and optional `sourceUrl`; every import source must be registered with its license and attribution in `docs/CREDITS.md`.

`meaningTh` and `meaningEn` become nullable. Vocabulary-backed word exercises and phrase/sentence exercises require at least one translation; character and syllable exercises may have none. `UserSettings.meaningLanguage` controls display preference, not whether content can be imported.

`Progress.status` is reduced to `'unlocked' | 'completed'`. A missing Progress document is the only representation of locked, completing the lazy-creation design from [[DEC-023]].

**Why:** Frequency data and provenance are valuable import metadata that must not be discarded. Spelling alone cannot identify a Korean lexical entry. Requiring two translations for every character or syllable misrepresents the content. Storing both a missing-is-locked state and a stored locked status introduces an invalid duplicate state.

**Consequences:** [[DEC-010]]'s required-meaning rule is superseded, and [[DEC-009]]'s three-state Progress model is superseded by the missing/unlocked/completed model. Existing code and persisted documents require a separate implementation/migration change; this decision changes documentation only.

---

## DEC-026 — Learning Modes, shared learner state, and contiguous progression frontier

**Date:** 2026-09-27
**Status:** Accepted

**Decision:** Keep `Course → Unit → Lesson → LessonExercise` exclusively for
the structured Learning Path. Daily Quest, Topic, Keyboard Position, Random
Practice, and Review are separate experiences that select shared content rather
than Course variants or duplicate curricula.

Learning Path progression uses a contiguous completion frontier: the
recommended lesson is the first lesson in global order that is not completed.
A soft-locked future Learning Path lesson may be practiced and completed early;
that completion is retained. When advancing after a Learning Path completion,
skip already-completed future lessons but stop at the first missing or unlocked
lesson. Practice Modes, Daily Quest, and Review never write LessonProgress or
unlock Learning Path content.

Topics are metadata plus `VocabularyEntry.topicIds` membership. Topic counts
derive from global VocabularyProgress and use Practiced/Encountered wording;
part-of-speech groups derive from VocabularyEntry metadata where possible.
VocabularyProgress is limited to encounter timestamps, exercise count, and raw
accepted/rejected keystroke counters. JamoStats uses the expected jamo as its
identity and counter attribution; Keyboard Position only filters those shared
stats.

Daily Quest owns a stable daily vocabulary set and grants EXP once per quest;
the dateKey timezone policy is deferred. MVP EXP remains conservative:
Learning Path follows its existing rule, Daily Quest awards once, and Topic,
Keyboard Position, Random Practice, and Review award none. All may update
shared stats/progress/review state where applicable, but never curriculum
progression.

**Why:** These boundaries let learners revisit and practice shared content in
multiple experiences without copying content, duplicating mastery systems, or
letting optional practice bypass curriculum progression. A contiguous frontier
preserves out-of-order Learning Path work without leaving learners stranded.

**Consequences:** Adds target Topic, VocabularyProgress, JamoStat, and
DailyQuestProgress documentation. The current code and Firestore data do not
yet implement this decision; implementation requires separate domain,
repository, mapper, use-case, migration, and test work.
