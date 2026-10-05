# Decision Log

Architecture and product decisions for Jamozy, in chronological order. Each entry: what was decided, why, and alternatives considered (if any). Add new entries at the bottom.

Status values: `Accepted`, `Superseded by DEC-00X`, `Rejected`.

## How to use this file

- Read this index first. Open only the entries you need by searching for
  their heading (`## DEC-0NN`); do not read the whole file.
- When adding a decision, append the entry at the bottom and add its row
  here. When a decision is superseded, update its status in both places.

## Index

| DEC | Decision | Status | Date |
| --- | -------- | ------ | ---- |
| DEC-001 | Firebase Anonymous Auth for identity, no traditional sign-up | Superseded by DEC-027 | 2026-09-23 |
| DEC-002 | Layered architecture: domain / application / infrastructure / features | Accepted | 2026-09-23 |
| DEC-003 | Keystroke-level state stays client-side; Firestore writes only at checkpoints | Accepted (Home exercise-completion checkpoint: DEC-043) | 2026-09-23 |
| DEC-004 | MVP excludes multiplayer, leaderboards, and social/competitive features | Accepted | 2026-09-23 |
| DEC-005 | Pin `@vitejs/plugin-react` to 5.2.0, not latest | Accepted | 2026-09-23 |
| DEC-006 | Level is derived from EXP, never stored | Accepted | 2026-09-23 |
| DEC-007 | Settings live as a field on the user doc | Accepted | 2026-09-23 |
| DEC-008 | Spaced repetition (Leitner boxes) for review scheduling | Accepted | 2026-09-23 |
| DEC-009 | Sequential unlock: previous lesson completed unlocks the next | Accepted (creation/ordering details superseded by DEC-023; Progress-state shape superseded by DEC-025) | 2026-09-23 |
| DEC-010 | `LessonExercise` gains `difficulty` and split Thai/English `meaning` | Accepted (meaning nullability superseded by DEC-025) | 2026-09-23 |
| DEC-011 | `UserStats` added as an embedded entity on `UserProfile` | Accepted (field shape superseded by DEC-022) | 2026-09-23 |
| DEC-012 | `ReviewItem.reason` field added | Accepted | 2026-09-23 |
| DEC-013 | `UserSettings` expanded to the full requirement.md list | Accepted (field shape superseded in part by DEC-027) | 2026-09-23 |
| DEC-014 | Application-layer additions found necessary while building the use cases | Accepted | 2026-09-23 |
| DEC-015 | Firestore content-write security boundary | Superseded — client content writes locked before launch | 2026-09-23 |
| DEC-016 | Composite Firestore indexes, and `ensureUser` injected into loaders (not imported) | Accepted | 2026-09-23 |
| DEC-017 | Korean typing engine: own 2-beolsik composition, not the OS IME; jamo-level blocking; progressive partial-compound display | Accepted | 2026-09-24 |
| DEC-018 | Lesson typing session: accuracy scale boundary, deterministic `ReviewItem` id, and a store `generation` counter to survive React StrictMode | Accepted | 2026-09-24 |
| DEC-019 | Review system: unbounded due-count default, strict per-item correctness, no same-session requeue, and reusing the `generation` counter for a second store consumer | Accepted | 2026-09-24 |
| DEC-020 | Settings UI: shared `defaultUserProfile`, and two fetcher/equality pitfalls that only manual browser testing caught | Accepted | 2026-09-24 |
| DEC-021 | Profile Dashboard: display-only rounding of running-average stats | Accepted | 2026-09-25 |
| DEC-022 | Vocabulary-backed review identity and raw aggregate typing counters | Accepted | 2026-09-27 |
| DEC-023 | Lazy Progress creation, canonical progression ordering, and profile update timestamp | Accepted (Home course excluded from global order: DEC-043) | 2026-09-27 |
| DEC-024 | ID conventions, bounded lessons, deterministic review reasons, and deferred level balancing | Accepted | 2026-09-27 |
| DEC-025 | Vocabulary import identity and nullable meanings; simplify persisted Progress states | Accepted | 2026-09-27 |
| DEC-026 | Learning Modes, shared learner state, and contiguous progression frontier | Accepted (Home course exception: DEC-043) | 2026-09-27 |
| DEC-027 | Guest local persistence and migration to authenticated accounts | Accepted | 2026-09-27 |
| DEC-028 | Shared learner-state checkpoints and Daily Quest completion | Accepted | 2026-09-27 |
| DEC-029 | Session history separated from learner state and lifetime aggregates | Accepted (`home` session context: DEC-043) | 2026-09-28 |
| DEC-030 | Guest-to-account migration merge policy | Accepted (Home exercise-progress merge: DEC-043) | 2026-09-28 |
| DEC-031 | Preserve pre-session learner values as a compatibility baseline | Accepted | 2026-09-28 |
| DEC-032 | Lesson Result review action opens the due Review queue | Accepted | 2026-09-28 |
| DEC-033 | Intentional Learning Path replays grant 15 EXP | Accepted (Home replay = full shuffled session: DEC-043) | 2026-09-29 |
| DEC-034 | Admin content is claim-authorized and status-gated | Accepted (extended by DEC-043: `Course.type`, Home export) | 2026-09-29 |
| DEC-035 | Home one-page player uses browser-local exercise checkpoints | Superseded by DEC-043 | 2026-09-29 |
| DEC-036 | Jamo SVG steps follow visual jamo for compound medials | Superseded by DEC-037 | 2026-10-01 |
| DEC-037 | Jamo SVG steps follow typed keys, including compound medials | Accepted | 2026-10-01 |
| DEC-038 | Split recipes may partition an enclosed counter with its outline | Accepted | 2026-10-01 |
| DEC-039 | Jamo SVG runtime: committed choseong shards behind a flag | Accepted | 2026-10-03 |
| DEC-040 | Spaces between words keep the Jamo SVG target renderer | Accepted | 2026-10-04 |
| DEC-041 | AI agents propose and receive approval before acting | Accepted | 2026-10-04 |
| DEC-042 | Home player owns a continuous client queue; loader only refills | Accepted (cross-lesson queue superseded by DEC-043) | 2026-10-05 |
| DEC-043 | Home plays one static-exported course with synced exercise progress | Accepted | 2026-10-05 |

---

## DEC-001 — Firebase Anonymous Auth for identity, no traditional sign-up

**Date:** 2026-09-23
**Status:** Superseded by DEC-027

**Decision:** Use Firebase Anonymous Authentication to identify learners for the MVP instead of email/password or social sign-up.

**Why:** Removes friction for a casual, single-player typing-practice app. Learners can start practicing immediately without account creation. Cloud profile sync / Google account linking is deferred to a later phase (see README "Later" list).

**Consequences:** User data is tied to a device-local anonymous UID until linking is added. Losing local auth state loses progress access until account linking ships.

**Legacy implementation note:** Existing code, Firebase configuration, rules,
and older implementation plans may still use this path. It is historical/current
implementation context only, not the target architecture.

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
**Status:** Accepted (Home exercise completion is a checkpoint; see [[DEC-043]])

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
**Status:** Accepted (field shape superseded in part by DEC-027)

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

## DEC-015 — Firestore content-write security boundary

**Date:** 2026-09-23
**Status:** Superseded — client content writes locked before launch

**Original decision:** `courses`/`units`/`lessons` were readable and writable by
any signed-in user to unblock client-SDK seeding. `users/{userId}` and its
subcollections were readable/writable only by that same `uid`.

**Why:** `pnpm seed` (client SDK) initially failed with `PERMISSION_DENIED` —
the Firestore database had no rules deployed yet. There is no
admin/content-management tier, and the initial script used the same client SDK
as a player.

**Implemented replacement:** before launch, client rules were changed to make
`courses`, `units`, and `lessons` public read-only. No client, including an
authenticated player, can write those collections. Owner-only rules remain for
`users/{userId}/**`.

**Consequences:** the client-SDK `pnpm seed` script is no longer a valid way to
change production content. The planned post-MVP authoring path is an Admin BO
whose browser writes are gated by an `admin` Firebase Auth custom claim and
Firestore Rules; a controlled Admin SDK operator script provisions claims. No
Cloud Function is planned. Until that BO exists, Firebase Console procedures
remain an operational fallback.

**Deploy:** the restrictive rules are deployed. Any future rules change still
requires an explicit Firebase Console deployment procedure.

**Legacy implementation note:** the original permissive rule is historical and
does not define the Guest/Authenticated architecture in [[DEC-027]].

---

## DEC-016 — Composite Firestore indexes, and `ensureUser` injected into loaders (not imported)

**Date:** 2026-09-23
**Status:** Accepted

**Decision:** Two related fixes found via manual browser testing of the first UI feature (`docs/superpowers/plans/2026-09-23-course-lesson-ui.md`), both confirmed by a fresh whole-branch code review:

1. **`firestore.indexes.json`** added (+ wired into `firebase.json`). `FirebaseCourseRepository.getUnitsByCourseId` and `FirebaseLessonRepository.getLessonsByUnitId` combine a `where()` equality filter with `orderBy()` on a different field — Firestore requires a composite index for that query shape. Two indexes: `units` (`courseId` + `order`), `lessons` (`unitId` + `order`).
2. **`ensureUser: () => Promise<{ uid: string }>`** is now an injected dependency on every route loader (`CourseListPage.loader.ts`, `CourseMapPage.loader.ts`, `LessonDetailPage.loader.ts`), bound once in `src/app/router.ts` to `signInAnonymouslyIfNeeded` (`src/infrastructure/firebase/firebase.ts`). No file under `src/features/` imports `infrastructure/firebase` directly anymore.

**Why:** (1) `firestore.rules` ([[DEC-015]]) requires `request.auth != null` for reading `courses`/`units`/`lessons` at all, not just per-user data — but only `CourseMapPage.loader.ts` originally called `signInAnonymouslyIfNeeded()`, so `CourseListPage`/`LessonDetailPage` hit `PERMISSION_DENIED` in the browser. The fix (adding the call) worked, but duplicated the precondition into every loader with no test, and each loader importing `infrastructure/firebase/firebase` directly violates `AGENTS.md`'s layering rule ("never through `infrastructure/firebase` directly from `features/`") — the original plan itself sanctioned that import, so this was a plan defect, not an implementer mistake. (2) The composite-index error only surfaces against real Firestore — none of the fakes-based unit tests model Firestore's index requirements, so nothing caught it before the browser.

**Consequences:** Every loader now takes `ensureUser` as a constructor-style dependency and has a unit test (`*.loader.test.ts`) asserting it's called before any repository read — the exact bug class that broke in the browser is now pinned by a fast, no-network test, not just "eyeball it, low risk" as the original spec assumed. `NotFoundError` (`src/domain/errors.ts`) was added alongside this fix so `RouteError` can show "Not found." instead of a raw error message for a missing course/lesson — same review pass, same root cause category (spec under-tested the loader layer). **Deploy:** `firebase deploy --only firestore:indexes` (in addition to `firestore:rules`) is required before the course map works in any environment, including a fresh `firebase use` on another machine.

**Legacy implementation note:** `ensureUser` and `signInAnonymouslyIfNeeded` are
current implementation wiring for the superseded Anonymous Auth path. The
target design in [[DEC-027]] replaces this with session-aware persistence while
retaining the repository/application boundary.

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
**Status:** Accepted (the `home` course is outside the global order; see [[DEC-043]])

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
**Status:** Accepted (the single `home` course is a second Course-structured experience; see [[DEC-043]])

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

---

## DEC-027 — Guest local persistence and migration to authenticated accounts

**Date:** 2026-09-27
**Status:** Accepted

**Decision:** Guest learners do not use Firebase Authentication. They provide a
display name and receive a locally generated stable guest ID; their learner
state is stored in IndexedDB and becomes eligible for cleanup after 90 days
since the last persisted guest activity. Authenticated learners use
Email/password or Google Sign-In with Firebase Authentication and persist
learner state in Firestore.

Authentication chooses repository implementations, not learning behavior. The
same domain models and application use cases serve Guest and authenticated
sessions through local IndexedDB or Firebase repository adapters. `UserProfile`
holds a display name and learner data, never authentication provider state.
`showEnglishKeys` is removed from target UserSettings because English physical
key labels are always visible with Hangul labels.

Signing in from a Guest state eventually invokes an application-level,
provider-neutral `MigrateGuestDataToAccount` use case. It copies through
repository boundaries and is non-destructive, idempotent, and retry-safe.
Existing cloud data is a merge scenario: local data remains until success, cloud
state is never blindly replaced, deterministic IDs remain authoritative, and
duplicate EXP, Daily Quest rewards, or vocabulary-backed ReviewItems are not
created.

**Why:** A learner can begin without an account while retaining a clear,
privacy-friendly local persistence boundary. Repository substitution preserves
the existing clean architecture and avoids teaching every learning feature two
different behaviors. Safe migration prevents account creation from discarding
work or overwriting established cloud progress.

**Consequences:** [[DEC-001]] is superseded as the target identity and
persistence decision. Existing Anonymous Auth, Firestore rules, Firebase
adapters, and plans that depend on them are legacy implementation records until
separate implementation work replaces them. Field-level merge formulas are
defined by [[DEC-030]]. See `docs/AUTH-AND-PERSISTENCE.md`.

---

## DEC-028 — Shared learner-state checkpoints and Daily Quest completion

**Date:** 2026-09-27
**Status:** Accepted

**Decision:** VocabularyProgress is one accumulated record per learner and
VocabularyEntry across Learning Path, Daily Quest, Topic, Keyboard Position,
Review, and future practice modes. It records encounter/practice timestamps and
raw exercise/keystroke counters only; it has no mastery, familiarity, level,
score, or streak semantics. Topic displays therefore derive `Practiced` or
`Encountered` counts from these records rather than owning progress.

JamoStat is likewise one accumulated record per learner and expected jamo.
Correct input increments its accepted counter; rejected input increments the
counter for the jamo expected at that position, never the incorrectly pressed
jamo. Keyboard Position remains a filter over these records. JamoStat records
both first and latest submitted practice timestamps.

Shared learner-state counters and timestamps are aggregated from submitted
session results, never written per keystroke. DailyQuestProgress retains the
existing `dailyQuestProgress/{dateKey}` identity and adds `completedAt` in
addition to `expAwarded`: completion represents quest status, while
`expAwarded` makes the once-per-dateKey EXP grant idempotent. A Daily Quest
retry may update shared learner state and review scheduling, but never grants
that EXP twice or changes Learning Path progression.

**Why:** One record per underlying target avoids fragmenting learning history by
mode while retaining distinct responsibilities for curriculum progress, review
scheduling, global statistics, and quest rewards. Separating completion from
reward makes a failed/retried reward write observable without treating reward
status as course progression.

**Consequences:** Extends the target schemas in `docs/DOMAIN-MODEL.md` and the
shared-state rules in `docs/LEARNING-MODES.md`. The `dateKey` timezone policy,
vocabulary-selection algorithm, and Guest-to-account field-level merge formulas
remain unresolved. This is documentation only; no persistence, migration, or
typing-engine implementation changes.

---

## DEC-029 — Session history separated from learner state and lifetime aggregates

**Date:** 2026-09-28
**Status:** Accepted (adds a `home` LearningSessionContext; see [[DEC-043]])

**Decision:** `LearningSession` is the single historical record for a submitted
Learning Path, Daily Quest, Topic, Keyboard Position, Review, or Random
Practice activity. It records raw session totals, timing, actual EXP gained,
and a discriminated `LearningSessionContext` for source context. Accuracy and
WPM are derived from raw counters and duration. It does not persist detailed
keystrokes, `MistakeEvent` arrays, exercise snapshots, or per-jamo maps.

LearningSession is distinct from current learner state (`LessonProgress`,
`VocabularyProgress`, `JamoStat`, `ReviewItem`, and `DailyQuestProgress`) and
from lifetime aggregate `UserStats`. A shared submitted-session aggregation
updates all applicable records and creates history. Learning Path may also
update LessonProgress; Daily Quest may update DailyQuestProgress. History never
decides rewards, spaced-repetition scheduling, or curriculum progression.

`sessionId` is generated when active practice begins. A retry of the same
logical submission reuses it; an intentional replay starts a new ID. The
submitted session must therefore have logical exactly-once effects across its
LearningSession record and aggregate learner-state updates. The concrete
idempotency/atomicity mechanism is deferred to implementation.

Guest and authenticated learners share these semantics. Guest sessions persist
in IndexedDB under the existing 90-day inactivity retention policy;
authenticated sessions persist at `users/{userId}/learningSessions/{sessionId}`.
Migration preserves their IDs and must not create duplicate history records.

**Why:** Session records answer what happened during an activity without
overloading current state or forcing lifetime totals to be recomputed from an
unbounded history. A single model prevents mode-specific history silos while
stable IDs make retries and Guest-to-account migration safe.

**Consequences:** History and future Summary can query LearningSession records;
they do not introduce persisted period aggregates, a detailed analytics schema,
or a History UI. Only submitted/completed sessions are stored in MVP; abandoned
session recovery is deferred. See `docs/SESSION-AND-HISTORY.md`.

---

## DEC-030 — Guest-to-account migration merge policy

**Date:** 2026-09-28
**Status:** Accepted (Home exercise-progress merge rules in [[DEC-043]])

**Decision:** A Guest-to-account migration unions state by its deterministic
identity and is idempotent. `LessonProgress` keeps the furthest state
(`completed` > `unlocked` > `missing`). EXP and `UserStats` raw counters are
not added as two snapshots; only `LearningSession`s not yet aggregated in the
Cloud destination contribute their effects. Best accuracy and WPM use their
maximum values.

`ReviewItem`s union by their deterministic identity and retain the earlier
`nextReviewAt`, so migration never delays an already-due review. Daily quests
union by `dateKey`: `completed` and `expAwarded` are true if either source says
true. Settings use the newest trustworthy `updatedAt`, otherwise Cloud wins.
Cloud `displayName` wins unless it is absent, in which case the Guest name is
used. LearningSession records union by their original `sessionId` and are never
recreated during a migration or retry.

**Why:** These rules preserve the learner's most advanced curriculum state,
avoid duplicate rewards and lifetime totals, prevent review regressions, and
avoid overwriting established account preferences without reliable recency
information.

**Consequences:** `MigrateGuestDataToAccount` tracks destination session
receipts before applying EXP or raw counters. The implemented protocol writes
one terminal Cloud marker per `(guestId, uid)` only after all receipt
transactions complete; Guest data remains local for later cleanup.

---

## DEC-031 — Preserve pre-session learner values as a compatibility baseline

**Date:** 2026-09-28
**Status:** Accepted

**Decision:** Existing `UserProfile.exp` and `UserProfile.stats` values are an
immutable `legacyBaseline`; they are not retroactively interpreted as raw
LearningSession counters. New Lesson/Review submissions update a separate raw
`sessionAggregate`. The profile read model combines both for display.

During Guest-to-account migration, a Cloud baseline wins
unconditionally when both sources have one. Session history continues to union
by `sessionId` under [[DEC-030]].

**Why:** Historical aggregate values do not contain sufficient session data to
reconstruct exact raw counters or determine whether Guest and Cloud activity
overlaps. Treating them as raw would silently alter learner totals.

**Consequences:** Compatibility mapping is required in local/Firebase profile
adapters and profile summaries. The Guest-to-account migration preserves this
layer rather than attempting to reconstruct historical sessions. The legacy
baseline remains until a separate, safe migration retires it. Legacy average
accuracy/WPM are not combined with new raw values; the profile shows
session-tracked metrics separately. Profile derives its `Lessons completed`
display from `LessonProgress.status === 'completed'`, which is the current
learner-state source of truth rather than an aggregate or EXP proxy. For a
zero-valued legacy baseline, the Profile read model derives accuracy and WPM
from `sessionAggregate`'s raw counters. A non-zero baseline continues to
display its stored averages because their denominators cannot be reconstructed
safely.

---

## DEC-032 — Lesson Result review action opens the due Review queue

**Date:** 2026-09-28
**Status:** Accepted

**Decision:** The Lesson Result action is labelled `Go to Review` and navigates
to `/review`, the existing Leitner-scheduled Review queue. A word mistyped in
the completed lesson is not guaranteed to appear there immediately; it appears
only when its `nextReviewAt` is due. MVP does not introduce an immediate-mistake
practice flow.

**Why:** The Review queue has one established scheduling contract. A separate
immediate-practice flow would create a second, ambiguous review experience and
needs its own exercise-selection and scheduling rules.

**Consequences:** The Lesson Result button is navigation only. `ReviewItem`
creation and its Leitner schedule remain unchanged.

---

## DEC-033 — Intentional Learning Path replays grant 15 EXP

**Date:** 2026-09-29
**Status:** Accepted (a Home replay is one full shuffled session; see [[DEC-043]])

**Decision:** The first completed Learning Path attempt keeps its normal
accuracy-based EXP reward. An intentional replay of a lesson whose
`LessonProgress` is already `completed` creates a new submitted session and
grants a flat 15 EXP. It does not change the lesson's completion state, unlock
the next lesson, or create first-completion review effects.

**Why:** Replays are legitimate typing practice and should receive a small,
predictable reward without competing with progression through new content.

**Consequences:** This supersedes DEC-014's no-repeat-EXP rule for the active
`completeLessonSession` path. There is no daily cap in MVP; any future balance
limit needs its own persisted policy and decision.

---

## DEC-034 — Admin content is claim-authorized and status-gated

**Date:** 2026-09-29
**Status:** Accepted (extended by [[DEC-043]]: `Course.type` and the Home static export)

**Decision:** The single-owner `/admin` BO uses Firebase Auth's `admin: true`
custom claim for its UX guard and Firestore Rules authorization. Course, Unit,
and Lesson each persist `draft`, `published`, or `archived`; learner reads
require the item and every ancestor to be published. Archive records the prior
Draft/Published state in `archivedFromStatus`, without altering descendant
statuses or learner-owned data.

**Why:** Content authoring needs safe preparation and reversible removal, while
learner progress, ReviewItems, and LearningSessions rely on stable IDs.

**Consequences:** A local Admin SDK migration must mark legacy statusless
content Published before restrictive Rules deploy. The owner receives the claim
only through the local Admin SDK script and must refresh their sign-in token.
Exercises remain embedded and stable: authors may add, edit, and reorder them,
but retire them by archiving their Lesson instead of hard deletion.

---

## DEC-035 — Home one-page player uses browser-local exercise checkpoints

**Date:** 2026-09-29
**Status:** Superseded by [[DEC-043]]

**Decision:** Home is the primary Learning Path player. It offers the first
three incomplete courses, but a ten-exercise queue is always confined to one
selected course. Hero and explicit Course/ Lesson navigation remain available.

Completed exercise boundaries and partial raw lesson totals persist in an
IndexedDB record keyed by `(userId, courseId)`. This record stores a stable
submission ID per incomplete lesson, but never individual keystrokes. It is
browser-local for Guests and authenticated users alike; it is not a Firebase
record, migration entity, Progress record, or LearningSession history entry.

**Why:** Learners can refresh and continue the next prompt without writing
per keystroke or treating abandoned work as submitted activity. Keeping it
local meets the one-device-resume scope without expanding account migration.

**Consequences:** Completing a lesson’s final exercise submits exactly one
normal LearningSession through the existing receipt boundary, then removes
that lesson’s checkpoint. A failed completion retains its local submission ID
for retry. The player uses missing Progress as locked and only writes
`unlocked`/`completed`; legacy persisted `locked` entries are read as absent
without destructive cleanup. When no incomplete course remains, Home falls
back to its first three courses and replays their exercises; the existing
15-EXP replay policy ([[DEC-033]]) applies.

## DEC-036 — Jamo SVG steps follow visual jamo for compound medials

**Date:** 2026-10-01
**Status:** Superseded by DEC-037

**Decision:** The Jamo SVG Tagger's physical-step algorithm v2 keeps each
compound medial (`ㅘ ㅙ ㅚ ㅝ ㅞ ㅟ ㅢ`) as one SVG step, following the
visual letter rather than the two keys used to type it. Compound finals stay
one step per key (`값` remains `ㄱ / ㅏ / ㅂ / ㅅ`). The typing engine,
`hangul.ts`, and Lesson/Review keystroke sequences are unchanged.

**Why:** A compound medial reads as one visual vowel, and splitting it into
typed parts forced glyph-specific splits (for example `귌`) that do not match
how the letter is seen.

**Consequences:** This supersedes the "one SVG path per physical key" invariant
for medials only. A future runtime renderer must map the two medial keystrokes
onto one path. The version bump changes every extraction fingerprint;
`pnpm jamo-svg:migrate-step-algorithm` keeps reviews whose step sequence is
unchanged (including approval) and merges compound-medial steps' geometry for
the rest, returning them to `reviewing` for human re-approval. The measured
step-count tables in `HANGUL_SVG_ANALYSIS.md` describe algorithm v1.

---

## DEC-037 — Jamo SVG steps follow typed keys, including compound medials

**Date:** 2026-10-01
**Status:** Accepted

**Decision:** Physical-step algorithm v3 gives every typed key its own SVG
step. A compound medial contributes both keys, as compound finals already do:
`황` is `ㅎ / ㅗ / ㅏ / ㅇ`, `값` stays `ㄱ / ㅏ / ㅂ / ㅅ`. SVG steps therefore
match the typing engine's keystroke sequence (`hangul.ts`,
`target-sequence.ts`), which is unchanged.

**Why:** Jamozy shows typing progress one keystroke at a time. With one merged
medial step (DEC-036), typing ㅗ in `황` could only reveal the whole ㅘ.

**Consequences:** Supersedes DEC-036. The v2→v3 migration
(`pnpm jamo-svg:migrate-step-algorithm`) keeps approval for unchanged step
sequences. It divides each compound medial's geometry by shape: the widest
piece is the horizontal first key (ㅗ ㅜ ㅡ) and the rest is the second key;
those 21 reviews returned to `reviewing` for re-approval. A medial that cannot
be divided this way is marked `needs-split`.

---

## DEC-038 — Split recipes may partition an enclosed counter with its outline

**Date:** 2026-10-01
**Status:** Accepted

**Decision:** A split recipe may declare `counterContours`: counters that
`counterContours(source)` pairs with the recipe's source contour. Its pieces
may then consume source ranges and use anchors on those counters. Every
source-contour command and every counter command except the counter's leading
`M` must be consumed exactly once; a consumed counter cannot also be owned
whole. Recipes without counters are unchanged.

**Why:** Where a rounded initial touches a two-bar vowel (`여 요 효 륭`), the
counter between them is bounded by the initial's curve. A seam restricted to
the outline's own points can only be straight, so part of the initial was
painted as the vowel.

**Consequences:** Geometry is still only replayed font commands plus declared
straight seams. Proposals transfer counter recipes under the same command-
shape and point-distance guards as other recipes.

---

## DEC-039 — Jamo SVG runtime: committed choseong shards behind a flag

**Date:** 2026-10-03
**Status:** Accepted

**Decision:** `pnpm jamo-svg:compile-runtime` compiles approved reviews into
19 shards, `public/jamo-svg/pretendard-600/00.json`–`18.json`, indexed by
choseong through `getChoseongShardIndex`. Each glyph keeps the minimal
`{ width, paths[{ jamo, d }] }` shape; each shard adds `datasetSchemaVersion`,
`fontSha256`, and `unitsPerEm`. The shards are committed, and a test fails
when they drift from the approved reviews. The app loads only the shards a
target needs, caches them in memory, and shares concurrent requests.
`HangulTarget` renders SVG only when every syllable of the target has
approved data whose steps match the expected keys; otherwise the legacy
Canvas renders the whole target. Blank tiles show while shards load, and
Canvas renders after 1,500 ms. The renderer is off unless
`VITE_JAMO_SVG_RENDERER=1`; development builds also accept the
`localStorage` override `jamozy:jamo-svg-renderer` (`'1'`/`'0'`).

**Why:** Prove compiler → dataset → typing state → per-step coloring with
real data before more review work. Never mixing Pretendard SVG and Noto
Canvas in one target keeps font differences from looking like renderer
bugs, and the flag keeps Canvas available for direct comparison. Committed
shards keep build and deploy independent of the font and review tooling.
Shards are static content, not learner state, so the loader lives in
`src/infrastructure/jamo-svg/` without a repository interface.

**Consequences:** After approving reviews, run the compiler and commit the
shards with the reviews. Targets with a space or any non-syllable character
render Canvas. Per-syllable fallback, or retiring Canvas, is decided later
when coverage is high enough. Spec:
`docs/superpowers/specs/2026-10-03-jamo-svg-runtime-design.md`.

---

## DEC-040 — Spaces between words keep the Jamo SVG target renderer

**Date:** 2026-10-04
**Status:** Accepted

**Decision:** Amends DEC-039's fallback rule. A space in the target no longer
sends the whole target to Canvas. `HangulTarget` uses SVG when the target has
at least one syllable, every syllable has approved data with matching steps,
and every other character is a space. Each space renders as a narrow gap with
a bar colored by its `Space` key state (correct, current, pending). Any other
non-syllable character (punctuation, standalone jamo) still renders Canvas for
the whole target, and a target of only spaces renders Canvas.

**Why:** Multi-word targets were always Canvas only because of the space, the
most common reason a fully approved target fell back. A space has no glyph, so
it cannot mix fonts; the colored bar also shows learners when to press Space.

**Consequences:** Shards, the compiler, the loader, and the Canvas renderer are
unchanged. Targets without spaces render exactly as before.

---

## DEC-041 — AI agents propose and receive approval before acting

**Date:** 2026-10-04
**Status:** Accepted

**Decision:** AI agents may independently analyze a request, identify risks,
and prepare a recommendation, but must present the proposed scope and wait for
explicit user approval before changing files, executing a plan, or taking an
external action. This applies even to small, low-risk, cosmetic, or otherwise
clear changes.

When a request cannot be completed safely or clearly because of missing
requirements, authority, access, consequences, or a technical constraint, the
agent must ask before proceeding. It must not force a workaround, silently
expand the scope, or make the missing decision itself. Agents should request
clarification, help, or collaboration when that improves confidence. They
should state the relevant fact and ask the next useful question rather than
repeatedly apologizing.

**Why:** Correctness and shared understanding are more valuable than
unannounced autonomy. Explicit approval keeps responsibility for meaningful
decisions with the user while still allowing agents to contribute analysis and
recommendations.

**Consequences:** `AGENTS.md` and `CLAUDE.md` require approval before any
change or external action. The prior convention allowing clear, small,
low-risk, or cosmetic changes to be implemented immediately is replaced.

---

## DEC-042 — Home player owns a continuous client queue; loader only refills

**Date:** 2026-10-05
**Status:** Accepted (cross-lesson queue and refill superseded by [[DEC-043]]; player-owned session rule kept)

**Decision:** The Home one-page player owns its current play queue and
position in client state (Zustand) for the life of a course round. Route
loader data seeds the queue once, on mount or course change; later loader
revalidations never restart or replace it. When three or fewer exercises
remain, the player requests the next batch (up to ten exercises after a
`(lessonId, exerciseId)` cursor, in canonical Learning Path order) and
appends it without resetting the current exercise, timers, or counters.
Replay courses wrap to their first exercise.

Checkpoints, lesson completion, EXP, review items, and completion retries
run in the background. The player shows no saving state and no manual
"save completed lesson" control; a pending lesson completion is retried
automatically.

**Why:** Home is a pick-up-and-play surface: see a word, type it, get the
next one immediately. The previous ten-exercise round paused on its last
word until checkpoints drained and the loader revalidated, and any
revalidation during play rebuilt the queue and jumped back to its start.

**Consequences:** Persistence semantics from [[DEC-035]] are unchanged:
browser-local checkpoints keyed by `(userId, courseId)`, one
LearningSession per completed lesson through the receipt boundary, no
per-keystroke writes. A cursor-based refill is independent of checkpoint
acknowledgement, so in-flight saves cannot cause duplicates or gaps.
Loader data is still not mirrored into Zustand; only the transient play
queue lives there ([[DEC-003]]). DEC-035's ten-exercise round and
end-of-round revalidation are superseded.

A refill keeps the player's course even if that course stopped being
selectable mid-play; if its last lesson completed before the refill, the
course is then a replay course and wraps. The player compacts finished
exercises out of its session and keeps only running WPM/accuracy totals.
Pending lesson completions are retried once on mount. Other Home loader
data (for example the due-review count) refreshes on the next navigation,
not after each lesson.

---

## DEC-043 — Home plays one static-exported course with synced exercise progress

**Date:** 2026-10-05
**Status:** Accepted

**Decision:**

*Content.* `Course` gains `type: 'learning' | 'home'`; an absent type reads
as `learning`. Exactly one published `home` course exists. Admin BO and
Firestore remain its source of truth and keep [[DEC-034]]'s status gating. A
build script exports the published Home course (units, lessons, exercises) to
a static JSON file; the build fails unless exactly one published `home`
course exists. At runtime Home reads only that JSON, so content changes reach
learners on the next deploy. The `home` course is excluded from the Learning
Path global order and frontier, the course list, Daily Quest, and unlock
rules ([[DEC-009]], [[DEC-023]], [[DEC-026]]); learners may open any of its
units or lessons.

*Presentation.* Home lists the course's units as categories. A selected unit
lists its lessons, each showing distinct completed exercises out of its
total (for example `3/5`). A completed lesson always shows full (`5/5`).

*Sessions.* Entering a lesson shuffles all of its exercises once; a session
never repeats an exercise before it has played every exercise. Each new
session, including after a refresh, shuffles again. When a session ends,
Home moves automatically to the next lesson, then to the next unit, with a
short non-blocking notice. After the last unit, the Home course is shown as
completed and every lesson stays playable.

*Exercise progress and completion.* `Progress` for a Home lesson also stores
the distinct `completedExerciseIds` and the raw partial result (accepted and
rejected keystrokes, mistakes, start time, and a stable `submissionId`) of
those first completions. It is permanent and syncs like other Progress. When
the IDs first cover every exercise, the lesson becomes `completed` and one
LearningSession is submitted from the partial result with accuracy-based EXP;
its `sessionId` is the partial result's `submissionId`. Exercises played
after that within the same session submit nothing more. A later session that
plays a completed lesson's whole shuffle submits a replay session worth 15
EXP ([[DEC-033]]); an abandoned session submits nothing. Completion is never
reset. Home lessons never create ReviewItems.

*Resume.* Only `{ unitId, lessonId }` is kept, locally. A refresh restarts
that lesson with a new shuffle; exercise progress is unaffected.

*Background work.* Learning never waits on persistence. Home renders from the
JSON and the last locally cached Progress, then refreshes Progress in the
background. Every write (exercise progress, completion, replay session) goes
to a durable local outbox, is retried in the background until it succeeds,
and is idempotent by its stable IDs. A failed write is never shown as a
blocking state.

**Why:** Firestore content reads took ~1.8 s of a ~2.3 s Home load. Static
content removes them, while Admin BO keeps authoring control. Syncing
exercise progress and the partial result keeps counts and first-completion
EXP correct across devices.

**Consequences:** This supersedes [[DEC-035]] (no local Home checkpoint) and
replaces [[DEC-042]]'s cross-lesson continuous queue with lesson-scoped
shuffled sessions. DEC-042's rule still applies: the player owns its session
and loader data never resets it. [[DEC-034]] is extended with `Course.type`
and the export step. A completed Home exercise is a persistence checkpoint:
one write per exercise, never per keystroke ([[DEC-003]]).
`LearningSessionContext` gains `{ mode: 'home'; lessonId }` ([[DEC-029]]).
Guest-to-account migration ([[DEC-030]]) unions `completedExerciseIds`; if
either side is `completed`, its partial result is dropped, otherwise the
Cloud partial result wins unless absent. Profile's `Lessons completed`
([[DEC-031]]) counts completed Home lessons, since it derives from
`LessonProgress`. Because a missing type reads as `learning`, the course
list filters `home` out in the adapter rather than with a Firestore
`where('type', '==', 'learning')` query, which would drop untyped courses.

