# Rebirth on Profile Implementation Plan

> **For agentic workers:** Read the spec and this plan before implementation. Execute tasks in order, checking each task with focused tests. Do not create commits, tags, pushes, or releases unless the user explicitly requests them.

**Goal:** A learner at Level 100+ can perform an idempotent Rebirth from Profile; the page shows persisted Rebirth Count and earned Perk Points for Guest and account users.

**Architecture:** Embed canonical current-cycle and lifetime progression in `UserProfile`. Apply EXP and Rebirth inside the existing IndexedDB/Firestore transaction boundaries, then expose a small application use case through a Profile route action. Preserve legacy EXP aggregates for history and migrate Rebirth records by operation ID.

**Tech Stack:** React 19, TypeScript, React Router, IndexedDB, Firestore, Vitest, Firebase Rules Emulator.

**Spec:** `docs/superpowers/specs/2026-10-14-rebirth-profile-design.md`

## Global constraints

- Keep UI persistence behind `application/` and `domain/repositories/`.
- Rebirth requires Level 100+, remains optional, resets current-cycle EXP to 0, increments Rebirth Count and persisted earned Perk Points by 1, and preserves lifetime/learning state.
- `perkPointsEarned` means lifetime points awarded; Perk spending and effects are outside this plan.
- Current `expRequiredForNextLevel(level, rebirthCount)` and existing EXP award amounts do not change.
- Each accepted session and Rebirth operation has exactly-once effects; Guest and account behavior must agree.
- Use focused logic, adapter, and Rules tests. Do not add UI-only visual tests or run the full test suite by default. Run one build during final verification only if the cross-layer risk warrants it.
- Do not create a git commit; suggest its message at handoff.

## Review focus

1. A profile with `exp` plus `sessionAggregate.exp` but no progression normalizes once; a later read cannot count legacy EXP again. Covered by Task 1.
2. A Settings or display-name save concurrent with Rebirth cannot restore stale `currentExp` or `rebirthCount`. Covered by Task 2.
3. A delayed Home outbox result accepted after Rebirth contributes once to the new cycle. Covered by Task 2.
4. Two different Rebirth IDs racing at Level 100 result in one record and one earned point. Covered by Task 3.
5. Guest-to-account migration with a default Cloud profile cannot double count the Guest cycle EXP while importing receipts. Covered by Task 4.

---

### Task 1: Canonical progression model and profile reads

**Files:**

- Modify: `src/domain/models/user-profile.ts`, `src/domain/models/user-profile.test.ts`
- Modify: `src/application/get-profile-summary.ts`, `src/application/get-profile-summary.test.ts`
- Modify: `src/infrastructure/firebase/repositories/firebase-user-profile-repository.ts`, `src/infrastructure/firebase/repositories/firebase-user-profile-repository.test.ts`

**Interfaces:**

- Produce `ProgressionState { currentExp; totalExpEarned; highestLevel; rebirthCount; perkPointsEarned }`, optional `UserProfile.progression` for legacy records, and `progressionOf(profile: UserProfile): ProgressionState`.
- Produce `awardProgressionExp(state: ProgressionState, amount: number): ProgressionState`; it preserves Rebirth Count and earned points, increments both EXP fields, and updates `highestLevel` using the active curve.
- Extend `ProfileSummary` with `rebirthCount`, `perkPointsEarned`, and `currentExp`; retain `exp` as the lifetime total for compatibility.

- [ ] Write model tests for a new profile (`currentExp=0`, `totalExpEarned=0`, `highestLevel=1`, counters 0), legacy `exp=100` plus aggregate `exp=50`, a canonical profile with legacy fields still present, and awarding EXP after one Rebirth. Assert Level uses `currentExp` and the active Rebirth Count.
- [ ] Run `pnpm exec vitest run src/domain/models/user-profile.test.ts`; confirm the new tests fail for missing behavior.
- [ ] Implement the model helpers, canonical default, and Firestore mapper round trip. Decode a missing `progression` without writing; encode canonical progression on the next profile save. Reject non-finite/negative legacy EXP at the normalization boundary.
- [ ] Update the Profile summary to use `progressionOf`, and test Level 1 after a canonical Rebirth even when lifetime `exp + sessionAggregate.exp` exceeds the Level 100 threshold.
- [ ] Run `pnpm exec vitest run src/domain/models/user-profile.test.ts src/application/get-profile-summary.test.ts src/infrastructure/firebase/repositories/firebase-user-profile-repository.test.ts`; expect PASS.

### Task 2: Award EXP once and protect progression from stale profile saves

**Files:**

- Modify: `src/domain/repositories/user-profile-repository.ts`
- Modify: `src/app/learner-repositories.ts`, `src/test/fakes.ts`
- Modify: `src/infrastructure/local/guest-database.ts`, `src/infrastructure/local/local-repositories.ts`, `src/infrastructure/local/local-session-submission-repository.test.ts`
- Modify: `src/infrastructure/firebase/repositories/firebase-session-submission-repository.ts`, `src/infrastructure/firebase/repositories/firebase-session-submission-repository.test.ts`, `src/infrastructure/firebase/repositories/firebase-user-profile-repository.ts`
- Modify: `src/application/complete-lesson-session.ts`, `src/application/home-session-submission.ts`, `src/application/complete-lesson.ts`, `src/application/update-settings.ts`, `src/application/update-display-name.ts`
- Modify focused tests beside those use cases, including `src/application/home-outbox.test.ts`

**Interfaces:**

- Consume `progressionOf` and `awardProgressionExp` from Task 1.
- Extend `UserProfileRepository` with field-specific `saveSettings(userId, settings, now)` and `saveDisplayName(userId, displayName, now)` so preference/name writes do not carry a stale progression snapshot. Keep `saveUserProfile` for profile creation/compatibility; do not use it for those two edits.
- For the older `completeLesson` path, add `awardLegacyLesson(userId: string, award: { expGained: number; accuracy: number; speedWpm: number; durationSeconds: number; wordsPracticed: number; now: Date }): Promise<UserProfile>`. The adapter computes stats and progression from the profile read inside its transaction; avoid a stale read-then-save.

- [ ] Add failing focused tests: a receipt duplicate awards zero extra cycle/lifetime EXP; a delayed Home outbox job after Rebirth awards into the new cycle once; a Settings/name write based on stale state cannot revert a newer Rebirth; and the older lesson path updates canonical progression.
- [ ] Run the affected focused tests and confirm the new assertions fail.
- [ ] In the Guest `putSessionOnce` transaction and Firestore `submit` transaction, update canonical progression only for a newly inserted receipt. Preserve existing `sessionAggregate` behavior. Return current Level by reading canonical state after submission, including duplicate submissions, instead of calculating from a pre-submit profile snapshot.
- [ ] Implement field-specific profile writes with IndexedDB/Firestore atomic patch behavior; route Settings/name use cases through them, and wire the methods through active-adapter selection and test fakes. Restrict the remaining production `saveUserProfile` calls to profile creation; make an existing profile win over a racing create so canonical progression cannot be overwritten.
- [ ] Make legacy lesson completion award EXP atomically through its new repository operation and derive Level from the returned canonical state.
- [ ] Run `pnpm exec vitest run src/infrastructure/local/local-session-submission-repository.test.ts src/infrastructure/firebase/repositories/firebase-session-submission-repository.test.ts src/application/complete-lesson-session.test.ts src/application/home-session-submission.test.ts src/application/home-outbox.test.ts src/application/complete-lesson.test.ts src/application/update-settings.test.ts src/application/update-display-name.test.ts`; expect PASS.

### Task 3: Atomic Rebirth command for Guest and account

**Files:**

- Create: `src/domain/models/rebirth.ts`, `src/domain/models/rebirth.test.ts`
- Create: `src/domain/repositories/rebirth-repository.ts`
- Create: `src/application/rebirth.ts`, `src/application/rebirth.test.ts`
- Modify: `src/infrastructure/local/guest-database.ts`; create `src/infrastructure/local/local-rebirth-repository.ts` and its test
- Create: `src/infrastructure/firebase/repositories/firebase-rebirth-repository.ts` and its test
- Modify: `firestore.rules`, `firestore.rules.test.ts`, `src/app/learner-repositories.ts`, `src/app/router.ts`

**Interfaces:**

- Produce `RebirthRecord { id; rebirthNumber; levelAtRebirth; expAtRebirth; createdAt }`.
- Produce `RebirthResult = { status: 'rebirthed' | 'already-applied'; record: RebirthRecord } | { status: 'ineligible'; level: number }`.
- Produce `RebirthRepository.rebirth(userId: string, operationId: string, now: Date): Promise<RebirthResult>` and `rebirth(deps: { rebirthRepo: RebirthRepository }, userId: string, operationId: string, now?: Date): Promise<RebirthResult>`.

- [ ] Test the pure transition at Level 99, exactly Level 100, and above Level 100. Assert preservation of lifetime EXP, highest Level, profile fields, and a one-point increment. Test that a repeated ID returns the original record and two distinct concurrent IDs produce only one success.
- [ ] Run `pnpm exec vitest run src/domain/models/rebirth.test.ts src/application/rebirth.test.ts`; confirm failure before implementation.
- [ ] Implement the pure transition and application use case. Treat an empty/malformed operation ID as invalid before persistence. Make the repository transaction check the record before eligibility so a retry after the reset returns `already-applied`.
- [ ] Bump the Guest IndexedDB schema for a `rebirths` store and implement an atomic profile/record transaction. Implement the equivalent Firestore `runTransaction`, reading the record and profile before writing. Add the active-adapter routing in `createLearnerRepositories`.
- [ ] Add Rules: owner may create/read `rebirths/{operationId}`; update/delete and cross-user access fail. Test against the Emulator. The existing owner-writable profile remains a documented security boundary, not a tamper-proof claim.
- [ ] Run `pnpm exec vitest run src/domain/models/rebirth.test.ts src/application/rebirth.test.ts src/infrastructure/local/local-rebirth-repository.test.ts src/infrastructure/firebase/repositories/firebase-rebirth-repository.test.ts src/app/learner-repositories.test.ts`; expect PASS. Run `pnpm test:rules` once after the Rules changes; expect its focused Emulator suites to pass.

### Task 4: Rebirth-safe Guest-to-account migration

**Files:**

- Modify: `src/domain/models/guest-migration.ts`, `src/domain/models/guest-migration.test.ts`
- Modify: `src/domain/repositories/account-migration-repository.ts`, `src/application/migrate-guest-data-to-account.ts` and their tests
- Modify: `src/infrastructure/local/local-guest-migration-repository.ts`, `src/infrastructure/local/local-guest-migration-repository.test.ts`
- Modify: `src/infrastructure/firebase/repositories/firebase-account-migration-repository.ts`, `src/infrastructure/firebase/repositories/firebase-account-migration-repository.test.ts`

**Interfaces:**

- Extend `GuestMigrationSnapshot` with `rebirths: RebirthRecord[]`.
- Extend `AccountMigrationRepository` with `reconcileRebirths(accountId: string, guestId: string, snapshot: GuestMigrationSnapshot): Promise<void>` before `markComplete`; retain existing session-receipt idempotency.

- [ ] Add failing tests for a Guest Rebirth into a default Cloud profile, a Guest plus Cloud Rebirth with distinct IDs, the same record ID on both sides, and migration replay after an interrupted attempt. Assert `rebirthCount === perkPointsEarned === unique record count`, unchanged Cloud cycle when either side has rebirthed, and no duplicate `currentExp` or `totalExpEarned`.
- [ ] Run `pnpm exec vitest run src/domain/models/guest-migration.test.ts src/application/migrate-guest-data-to-account.test.ts src/infrastructure/local/local-guest-migration-repository.test.ts src/infrastructure/firebase/repositories/firebase-account-migration-repository.test.ts`; confirm the new cases fail.
- [ ] Export Guest records. In `mergeInitialState`, write a durable pending Cloud migration record keyed by `guestId` in the same transaction that captures whether the Cloud learner was empty and whether either side had rebirthed; retries reuse this decision. For an empty Cloud learner, seed Guest canonical cycle and total once, then import receipts into lifetime aggregates without adding their EXP to canonical progression again. For an existing Cloud learner, each newly imported receipt adds to `totalExpEarned`; add to `currentExp` only when neither side has rebirthed. `getMarker` treats only a completed record as terminal.
- [ ] Implement `reconcileRebirths`: union Guest and Cloud records by operation ID, set `rebirthCount` and `perkPointsEarned` to the unique record count, and retain the larger `highestLevel` in one transaction. Write the completed marker only after this and all receipt imports succeed. Repeated or interrupted migration must reuse the pending decision and skip existing receipts/records.
- [ ] Run the four focused migration test files above; expect PASS. Test a second migration invocation returns without changing any counter or record.

### Task 5: Profile action and presentation

**Files:**

- Create: `src/features/profile/ProfilePage.action.ts`, `src/features/profile/ProfilePage.action.test.ts`
- Modify: `src/features/profile/ProfilePage.tsx`, `src/features/profile/ProfilePage.loader.ts`, `src/app/router.ts`

**Interfaces:**

- Consume `ProfileSummary` from Task 1 and `rebirth`/`RebirthResult` from Task 3.
- Produce `createRebirthAction(deps: { rebirthRepo: RebirthRepository; ensureUser: () => Promise<{ uid: string }> })` accepting a JSON `operationId`, returning a typed success, ineligible, or recoverable error result.

- [ ] Test the action's non-visual behavior: it uses the active user, rejects a malformed ID, returns the original outcome for a retry, and maps a transient repository failure to a recoverable result without changing the ID.
- [ ] Run `pnpm exec vitest run src/features/profile/ProfilePage.action.test.ts`; confirm failure before implementation.
- [ ] Add the action to `/profile` in the router. Show Rebirth Count and earned Perk Points at every Level. Gate the button at Level 100+, use the shared `Modal` for confirmation, submit a stable operation ID with `useFetcher`, disable repeated confirmation while pending, retain the ID after a transient error, and revalidate on success/ineligible result. Explain that pending Home results may later add EXP to the new cycle.
- [ ] Run `pnpm exec vitest run src/features/profile/ProfilePage.action.test.ts src/features/profile/ProfilePage.loader.test.ts`; expect PASS. Run Prettier and ESLint only on touched UI files. Do not add/update `ProfilePage.test.tsx` for visual markup or run a browser; hand the user a mobile/desktop visual checklist.

### Task 6: Documentation and final verification

**Files:**

- Modify: `docs/DOMAIN-MODEL.md`, `docs/DECISIONS.md`, `docs/AUTH-AND-PERSISTENCE.md`, `docs/PROGRESS.md`, `README.md` if its high-level status changes materially
- Append: `docs/log/2026-10.md`

- [ ] Update the authoritative schema and accepted decision for persisted `perkPointsEarned`, cycle EXP, idempotent Rebirth, and migration. Update the `PROGRESS.md` Open work index and implementation status only for behavior actually shipped. Append a short completion entry for this non-UI work.
- [ ] Run Prettier and ESLint on touched source files, then the focused tests from Tasks 1–5 and the Rules Emulator suite. Run `pnpm build` once because this change crosses the profile model, both adapters, route action, and router types. Check `git diff --check` and inspect `git status --short` before handoff.
- [ ] Report what changed, pass/fail evidence, remaining security limitation (owner-writable Firestore profile), manual Profile checks at 360px and 1280px, and a Conventional Commit message. Do not commit or push.
