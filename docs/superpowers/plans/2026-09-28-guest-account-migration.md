# Guest-to-account migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically merge the active Guest's persisted Lesson/Review data into a newly authenticated Firebase account without loss or duplicate session effects.

**Architecture:** `MigrateGuestDataToAccount` is an application use case over two repository interfaces. The local adapter exports one immutable Guest snapshot and retains a retry checkpoint; the Firebase adapter performs deterministic legacy-state merges plus one idempotent transaction per session receipt and writes a terminal Cloud marker. The auth action captures the Guest identity before Firebase Auth changes the active session and starts migration after successful authentication.

**Tech Stack:** TypeScript, Vitest, native IndexedDB, Firebase Firestore transactions, React Router.

**Spec:** `docs/superpowers/specs/2026-09-28-guest-account-migration-design.md`

## Global Constraints

- Migration starts automatically after successful Email/password or Google sign-in/sign-up; it has no onboarding or confirmation UI.
- Guest data is never deleted or made unavailable by this feature.
- Scope is existing `UserProfile`, `Progress`, `ReviewItem`, `LearningSession`, and session receipt data only.
- Cloud `legacyBaseline` wins when present; never sum legacy `exp`/`stats` snapshots.
- Session effects are applied only when the destination session receipt does not exist.
- A migration failure does not turn an otherwise successful authentication into an authentication failure.
- Do not run commands that deploy Firestore rules; provide the user with the deploy command.

## Review Focus

- A sign-in must use the Guest ID that existed before Firebase Auth state changes.
- Retrying after an interrupted migration must not duplicate a session aggregate, progress, or review mutation.
- A non-empty Cloud display name and existing Cloud baseline must survive the merge.
- A Guest review item must never move a Cloud review later than its earliest `nextReviewAt`.
- Missing DailyQuest/Vocabulary/Jamo data must not create empty Cloud documents.

---

### Task 1: Migration domain contract and pure merge functions

**Files:**
- Create: `src/domain/models/guest-migration.ts`
- Create: `src/domain/models/guest-migration.test.ts`
- Create: `src/domain/repositories/guest-migration-repository.ts`
- Create: `src/domain/repositories/account-migration-repository.ts`

**Interfaces:**
- Produces `GuestMigrationSnapshot`, `MigrationCheckpoint`, `MigrationMarker`, and pure `mergeProfile`, `mergeProgress`, and `mergeReviewItem` functions.
- `GuestMigrationRepository.getSnapshot(guestId)` returns profile/progress/reviews/session receipts without mutating local state.
- `AccountMigrationRepository` owns `mergeInitialState`, `migrateSessionReceipt`, and `markComplete` for one account/Guest pair.

- [x] Write failing pure tests for Cloud-baseline/display-name precedence, timestamp settings precedence, progress ordering/maxima, and ReviewItem earlier-due merge.
- [x] Implement the migration model and pure merge functions with exact DEC-030/031 rules.
- [x] Define narrow domain repository interfaces; do not expose IndexedDB or Firestore types.
- [x] Run `pnpm test -- src/domain/models/guest-migration.test.ts` and confirm pass.

### Task 2: Guest snapshot and local checkpoint adapter

**Files:**
- Modify: `src/infrastructure/local/guest-database.ts`
- Create: `src/infrastructure/local/local-guest-migration-repository.ts`
- Create: `src/infrastructure/local/local-guest-migration-repository.test.ts`

**Interfaces:**
- Consumes `GuestMigrationRepository` from Task 1 and current Guest stores (`profiles`, `progress`, `reviewItems`, `learningSessions`, `sessionOutcomes`).
- Produces a stable snapshot plus per-`guestId:uid` local checkpoint state.

- [x] Write failing adapter tests that snapshot only one Guest's records, preserve `Date` values, and keep Guest records after setting a completed checkpoint.
- [x] Bump IndexedDB schema and add a dedicated `migrationCheckpoints` store; never overload `guestSessions` or mutate learner records.
- [x] Implement `getSnapshot`, `getCheckpoint`, and `saveCheckpoint` through `GuestDatabase`.
- [x] Run `pnpm test -- src/infrastructure/local/local-guest-migration-repository.test.ts` and confirm pass.

### Task 3: Firebase migration adapter and rules

**Files:**
- Create: `src/infrastructure/firebase/repositories/firebase-account-migration-repository.ts`
- Create: `src/infrastructure/firebase/repositories/firebase-account-migration-repository.test.ts`
- Modify: `firestore.rules`

**Interfaces:**
- Consumes Task 1 `AccountMigrationRepository` and its pure merge functions.
- Produces transaction-safe `mergeInitialState(uid, guestId, snapshot)`, `migrateSessionReceipt(uid, receipt)`, `getMarker(uid, guestId)`, and `markComplete(uid, guestId)`.

- [x] Write failing fake-Firestore tests for an existing receipt no-op, one new receipt aggregate/effect write, Cloud profile precedence, and transaction-callback retry committing one aggregate.
- [x] Implement initial profile/progress/review merge using bounded Firestore writes; only data in the snapshot is addressed.
- [x] Implement one transaction per session receipt: return on existing Cloud receipt; otherwise merge its effects, write session/receipt, and add its aggregate once.
- [x] Add owner-only Firestore rules for `learningSessions`, `sessionOutcomes`, and `migrations` under `users/{userId}`.
- [x] Run `pnpm test -- src/infrastructure/firebase/repositories/firebase-account-migration-repository.test.ts` and confirm pass.

### Task 4: Application orchestration and automatic auth trigger

**Files:**
- Create: `src/application/migrate-guest-data-to-account.ts`
- Create: `src/application/migrate-guest-data-to-account.test.ts`
- Modify: `src/features/course/CourseListPage.action.ts`
- Modify: `src/features/course/CourseListPage.action.test.ts`
- Modify: `src/app/router.ts`

**Interfaces:**
- Consumes Task 1 repositories and the existing `AuthRepository`/`UserSessionRepository`.
- Produces `migrateGuestDataToAccount(source, destination, guestId, uid): Promise<MigrationResult>`.

- [x] Write failing use-case tests for first migration, completed-marker retry no-op, partial retry, and retained Guest data after a Cloud adapter error.
- [x] Implement orchestration: load/checkpoint snapshot, merge initial state, process all receipts sequentially, write Cloud marker, then local completed checkpoint.
- [x] Capture `guestId` before calling sign-in/sign-up/Google in the Course List action. On auth success, invoke migration; catch migration errors separately and still return an authenticated result.
- [x] Compose Local/Firebase migration adapters in `router.ts`; route revalidation remains driven by the existing auth-state listener.
- [x] Run `pnpm test -- src/application/migrate-guest-data-to-account.test.ts src/features/course/CourseListPage.action.test.ts` and confirm pass.

### Task 5: Documentation and verification handoff

**Files:**
- Modify: `docs/AUTH-AND-PERSISTENCE.md`
- Modify: `docs/DOMAIN-MODEL.md`
- Modify: `docs/DECISIONS.md`
- Modify: `docs/PROGRESS.md`
- Modify: `docs/COMPLETE-LOG.md`

- [x] Document automatic trigger, checkpoint/marker paths, no-deletion guarantee, in-scope entities, and the known absence of future-mode records.
- [x] Mark Guest-to-account migration done only after verification; retain cleanup/history UI as not started.
- [x] Give the user `firebase deploy --only firestore:rules`; do not deploy it.
- [x] Run `pnpm test`, `pnpm build`, and `pnpm lint`; record results before completion.

## Completion

Implemented natively on `feat/auth`. User reported focused and full tests,
build, and lint pass on 2026-09-28. The Firestore rules change remains
checked in but must be deployed by the user.

## Self-Review

- Spec acceptance criteria map to Task 4 (automatic trigger/recovery), Task 1/3 (merge semantics and receipts), Task 2/4 (non-destructive retry), and Task 3 (rules).
- The migration use case depends only on domain interfaces; IndexedDB/Firestore transaction mechanics remain in infrastructure.
- The plan does not add cleanup, migration UI, account linking, history UI, or entities absent from this branch.
