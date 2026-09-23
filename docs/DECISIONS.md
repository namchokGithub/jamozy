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
