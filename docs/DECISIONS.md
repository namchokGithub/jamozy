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
**Status:** Accepted

**Decision:** A lesson's `Progress.status` moves from `'locked'` to `'unlocked'` when the previous lesson (by `Lesson.order`, carrying across `Unit`/`Course` boundaries) reaches `status === 'completed'`. No accuracy threshold gates unlocking. The first lesson overall is unlocked by default (seed data, not derived).

**Why:** User's explicit choice — simplest rule matching the README's linear Learn → Unlock flow. No separate "unlock accuracy" product requirement exists yet.

**Consequences:** This transition is written by the `complete-lesson` application use case (sets the next lesson's `Progress.status`), not computed on read — keeps read paths simple at the cost of a slightly more involved write.

**Reaffirmed 2026-09-23:** cross-checked against `docs/requirement.md`'s 4-state (`Locked/Ready/Completed/Mastered`) suggestion. User re-confirmed the 3-state `locked/unlocked/completed` stands — no `Mastered` trigger defined, naming difference (`unlocked` vs `Ready`) is cosmetic.

---

## DEC-010 — `LessonExercise` gains `difficulty` and split Thai/English `meaning`

**Date:** 2026-09-23
**Status:** Accepted

**Decision:** `LessonExercise` adds `difficulty: 'easy' | 'medium' | 'hard'`, `meaningTh: string`, `meaningEn: string`. The existing `hint` field stays for non-meaning extras (e.g. keyboard tips), no longer doubles as "meaning."

**Why:** `docs/requirement.md`'s Vocabulary section (#3) stores Korean/Romanization/Thai-English-meaning/Difficulty/Lesson per word. Practice Mode (#6) filters by difficulty. Settings (#13) lets the learner pick meaning language (Thai/English/Both) — a single opaque `hint` string can't serve a language toggle.

**Consequences:** `meaningTh`/`meaningEn` are required (not nullable) — every exercise needs both at content-authoring time. `difficulty` is a 3-tier MVP placeholder; widening the union later is not a breaking schema change.

---

## DEC-011 — `UserStats` added as an embedded entity on `UserProfile`

**Date:** 2026-09-23
**Status:** Accepted

**Decision:** New `UserStats` shape (`lessonsCompleted`, `wordsPracticed`, `averageAccuracy`, `bestAccuracy`, `averageSpeedWpm`, `totalTypingTimeSeconds`), embedded as `UserProfile.stats`. `currentLevel` is deliberately excluded — it's `levelFromExp(exp)`, computed on read ([[DEC-006]]).

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
3. **`submit-review-result.ts`** (6th `application/` file, beyond README's 5) — advances a `ReviewItem`'s `box`/`nextReviewAt`/`resolved` via `nextBox`/`nextReviewDate` ([[DEC-008]]). Without it, `ReviewRepository.updateReviewItem` had no caller and spaced repetition couldn't actually progress.
4. **No repeat EXP/unlock on lesson retry** — `complete-lesson` checks whether the lesson was already `'completed'` before this call; if so, it still records the attempt (via `update-progress`) but skips awarding EXP and re-unlocking the next lesson. Not specified anywhere; chosen to avoid EXP farming via repeated retries.

**Why:** These are mechanical necessities to make already-decided behavior ([[DEC-008]], [[DEC-009]], [[DEC-006]]/[[DEC-011]] EXP+stats) actually executable, not new product scope.

**Consequences:** `application/complete-lesson.ts` is the most complex use case (reads/writes across 4 repositories). `application/get-review-items.ts` filters `ReviewRepository.getReviewItems()` client-side rather than a server-side query — fine at MVP scale, revisit if a user's review list grows large.
