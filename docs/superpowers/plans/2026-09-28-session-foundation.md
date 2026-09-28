# Learning session and exactly-once foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist Lesson/Review sessions and apply their effects exactly once while preserving legacy learner values as baselines.

**Architecture:** Application creates a submitted session and delegates one idempotent checkpoint to a persistence adapter. IndexedDB and Firestore each own their transaction mechanics; profile summaries combine an immutable baseline with raw post-foundation aggregates.

**Tech Stack:** TypeScript, Zustand, native IndexedDB, Firestore transactions, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-28-session-foundation-design.md`

## Global Constraints

- Scope is Lesson and Review only.
- No Guest-to-account migration implementation.
- Existing EXP/UserStats form an immutable baseline; Cloud baseline wins in future migration.
- Never persist per-keystroke data or full mistake-event arrays.
- React/application layers must not contain transaction logic.

## Review Focus

- Retrying a failed submit with the same session ID must return the original outcome without a duplicate write.
- A new replay must use a different session ID and count independently.
- A pre-existing profile with legacy values must retain them unchanged after new sessions.
- Firestore transaction retries must not duplicate review updates.
- Local and Firebase adapters must produce equivalent duplicate-session behavior.

---

### Task 1: Domain models and baseline profile shape

**Files:**
- Create: `src/domain/models/learning-session.ts`
- Create: `src/domain/models/session-aggregate.ts`
- Modify: `src/domain/models/user-profile.ts`
- Create: corresponding domain tests
- Modify: Firebase/local profile mappers

**Produces:** `LearningSession`, `LegacyBaseline`, `SessionAggregate`, derived accuracy/WPM helpers, and profile compatibility mapping for legacy documents.

- [ ] Write failing tests for zero guards, immutable baseline defaults, and profile summary combination.
- [ ] Implement domain types/mappers; preserve old profile values as `legacyBaseline` and start aggregate at zero.
- [ ] Run focused domain tests.

### Task 2: Checkpoint repository contract and Local adapter

**Files:**
- Create: `src/domain/repositories/learning-session-repository.ts`
- Create: `src/domain/repositories/session-submission-repository.ts`
- Modify: `src/infrastructure/local/guest-database.ts`
- Create: `src/infrastructure/local/local-learning-session-repository.ts`
- Create: `src/infrastructure/local/local-session-submission-repository.ts`
- Create: adapter contract tests

**Produces:** `submit(session, effects): Promise<SubmissionOutcome>` that returns the stored outcome for an existing session ID and writes session/profile/progress/review in one local transaction for a new ID.

- [ ] Write failing tests for same-ID retry, new-ID replay, Date round-trips, and baseline preservation.
- [ ] Implement IndexedDB stores/transaction adapter with no per-keystroke writes.
- [ ] Run focused local adapter tests.

### Task 3: Firebase transaction adapter

**Files:**
- Create: `src/infrastructure/firebase/repositories/firebase-learning-session-repository.ts`
- Create: `src/infrastructure/firebase/repositories/firebase-session-submission-repository.ts`
- Modify: Firebase repository exports and Firestore rules/paths if required
- Create: transaction-focused tests with fakes

**Produces:** equivalent `SessionSubmissionRepository` using a Firestore transaction over `users/{uid}/learningSessions/{sessionId}` and learner-state documents.

- [ ] Write failing tests for existing-session return, transactional aggregate update, and no duplicate review mutation on transaction retry.
- [ ] Implement Firebase transaction adapter and export it for authenticated composition.
- [ ] Run focused Firebase adapter tests.

### Task 4: Lesson and Review session integration

**Files:**
- Modify: lesson/review typing-session stores to create and retain a start-time session ID
- Modify: `complete-lesson-session.ts`, review submission use cases, route actions, and composed dependencies
- Modify: Lesson/Review tests

**Produces:** submitted Lesson/Review results that use `SessionSubmissionRepository`, reuse the ID for retry, and create a new ID for a real replay.

- [ ] Write failing Lesson and Review integration tests for duplicate submit/replay behavior.
- [ ] Route both flows through one checkpoint boundary; delete sequential duplicate-prone writes only after replacement coverage exists.
- [ ] Run focused integration tests.

### Task 5: Profile summary, documentation, and verification

**Files:**
- Modify: `get-profile-summary.ts`, `ProfilePage.tsx`, and tests
- Modify: `docs/DOMAIN-MODEL.md`, `docs/SESSION-AND-HISTORY.md`, `docs/AUTH-AND-PERSISTENCE.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`, `docs/COMPLETE-LOG.md`

- [ ] Add profile-summary tests proving exact baseline totals remain visible and
  post-foundation raw accuracy/WPM render separately as `Since session tracking`.
- [ ] Document Cloud-baseline precedence and mark only implemented Session History items done.
- [ ] Run `pnpm test`, `pnpm build`, and `pnpm lint`; record results before completion.

## Self-Review

- Each spec acceptance criterion has a task: idempotency/replay (2–4), baseline display (1/5), parity (2/3), and future migration policy (1/5).
- Firestore and IndexedDB transaction details stay below application interfaces.
- Migration, other modes, and history UI are explicitly excluded.

## Completion

Implemented natively on `feat/auth`. User verified the focused tests, full
`pnpm test`, `pnpm build`, and `pnpm lint` on 2026-09-28. The remaining
multi-device command-based transaction concern is recorded in this plan's SDD
ledger; Guest-to-account migration, additional modes, and history read/UI stay
out of scope.
