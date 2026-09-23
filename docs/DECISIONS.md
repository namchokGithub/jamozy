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

---

## DEC-009 — Sequential unlock: previous lesson completed unlocks the next

**Date:** 2026-09-23
**Status:** Accepted

**Decision:** A lesson's `Progress.status` moves from `'locked'` to `'unlocked'` when the previous lesson (by `Lesson.order`, carrying across `Unit`/`Course` boundaries) reaches `status === 'completed'`. No accuracy threshold gates unlocking. The first lesson overall is unlocked by default (seed data, not derived).

**Why:** User's explicit choice — simplest rule matching the README's linear Learn → Unlock flow. No separate "unlock accuracy" product requirement exists yet.

**Consequences:** This transition is written by the `complete-lesson` application use case (sets the next lesson's `Progress.status`), not computed on read — keeps read paths simple at the cost of a slightly more involved write.
