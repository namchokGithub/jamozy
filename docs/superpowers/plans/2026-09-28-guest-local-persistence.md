# Guest-local persistence and session-aware composition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing learner flows run as an automatically created, persistent IndexedDB Guest without Firebase Anonymous Auth, while centralizing future adapter selection.

**Architecture:** A session service owns one stable Guest identity and a native IndexedDB adapter owns Guest learner state. A session-aware composition module presents the existing learner repository interfaces to route loaders/actions and delegates by active `UserSession`; content repositories remain Firebase-backed.

**Tech Stack:** React 19, TypeScript, React Router 8, native IndexedDB, Firebase Firestore content reads, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-28-guest-local-persistence-design.md`

## Global Constraints

- Use `crypto.randomUUID()` for Guest identity and `crypto.getRandomValues()` to generate `Guest#0000`–`Guest#9999`.
- Do not use `localStorage` for learner state and do not add an IndexedDB dependency.
- The Course List control displays only the name and an edit control: no flag, onboarding, auth status, or account UI.
- Do not implement Email/password, Google Sign-In, migration, LearningSession, VocabularyProgress, JamoStat, DailyQuestProgress, or cleanup.
- Do not deploy Firestore rules, run build commands, run test commands, or create Git commits. Provide verification and deployment commands to the user only.
- Keep Firebase and IndexedDB out of React features and application use cases.

## Review Focus

- Reopening/reloading the app must reuse the same Guest ID and never create a second profile; Task 1 pins this.
- Different Guest IDs must never see one another's progress or review records; Task 2 pins this.
- A missing legacy Firebase profile field must not make Firebase mapping throw; Task 1 pins this.
- A display-name save must preserve the Guest ID even when the value changes; Task 5 pins this.
- Route work must never call `signInAnonymouslyIfNeeded`; Task 4 pins this by injecting only an active-session dependency.

---

## File Structure

- `src/domain/models/user-session.ts` — session types and Guest session metadata.
- `src/domain/models/user-profile.ts` — target `displayName`/`updatedAt` fields and default profile creation.
- `src/domain/repositories/user-session-repository.ts` — active-session contract.
- `src/application/get-active-user-session.ts` and `update-display-name.ts` — session retrieval and name mutation without UI/persistence imports.
- `src/infrastructure/local/guest-database.ts` — native IndexedDB schema, date encoding, and transaction helpers.
- `src/infrastructure/local/*-repository.ts` — local implementations of existing learner repository interfaces.
- `src/infrastructure/local/guest-session-repository.ts` — session creation/reuse and Guest profile initialization.
- `src/app/learner-repositories.ts` — session-aware repository delegators and route composition dependencies.
- `src/app/router.ts` — route wiring without Firebase Anonymous Auth.
- `src/features/course/*` — header display-name loader data, action, and inline edit control.
- `firestore.rules` — public read / denied client write for shared content only.

### Task 1: Align profile and define Guest session contracts

**Files:**
- Create: `src/domain/models/user-session.ts`
- Create: `src/domain/models/user-session.test.ts`
- Create: `src/domain/repositories/user-session-repository.ts`
- Create: `src/application/get-active-user-session.ts`
- Create: `src/application/update-display-name.ts`
- Create: `src/application/update-display-name.test.ts`
- Modify: `src/domain/models/user-profile.ts`
- Modify: `src/domain/models/user-profile.test.ts`
- Modify: `src/infrastructure/firebase/repositories/firebase-user-profile-repository.ts`
- Create: `src/infrastructure/firebase/repositories/firebase-user-profile-repository.test.ts`

**Interfaces:**
- Produces `UserSession`, `GuestSession`, `UserSessionRepository.getActiveSession(): Promise<UserSession>`, and `createGuestIdentity(crypto: Crypto): { guestId: string; displayName: string }`.
- Produces `updateDisplayName(userProfileRepo, userId, displayName, now): Promise<UserProfile>`.
- Extends `UserProfile` with `displayName: string` and `updatedAt: Date`; `defaultUserProfile(userId, now, displayName)` initializes both timestamps to `now`.

- [ ] **Step 1: Write failing domain/application tests**

Cover a valid Guest session, a generated-name formatter result such as `Guest#0042`, default profile name/timestamps, and `updateDisplayName` changing only `displayName`/`updatedAt` while preserving `id`, EXP, settings, and stats.

- [ ] **Step 2: Provide the focused verification command without running it**

```bash
pnpm test -- src/domain/models/user-session.test.ts src/domain/models/user-profile.test.ts src/application/update-display-name.test.ts src/infrastructure/firebase/repositories/firebase-user-profile-repository.test.ts
```

- [ ] **Step 3: Implement the domain contracts and use cases**

Use `GuestSession` fields `guestId`, `displayName`, `createdAt`, and `lastActiveAt`. `createGuestIdentity` must call `crypto.randomUUID()` once and derive the four-digit name from `crypto.getRandomValues(new Uint32Array(1))[0] % 10000`. Validate a trimmed, non-empty display name in `updateDisplayName`; preserve the existing repository-interface boundary. Add mapper fallbacks for legacy Firebase documents missing `displayName` or `updatedAt`.

- [ ] **Step 4: Provide the same focused verification command and expected result**

Expected: all listed tests pass. Do not execute it.

### Task 2: Build native IndexedDB Guest persistence

**Files:**
- Create: `src/infrastructure/local/guest-database.ts`
- Create: `src/infrastructure/local/guest-database.test.ts`
- Create: `src/infrastructure/local/guest-session-repository.ts`
- Create: `src/infrastructure/local/guest-session-repository.test.ts`
- Create: `src/infrastructure/local/local-user-profile-repository.ts`
- Create: `src/infrastructure/local/local-progress-repository.ts`
- Create: `src/infrastructure/local/local-review-repository.ts`
- Create: `src/infrastructure/local/local-repositories.test.ts`

**Interfaces:**
- Consumes Task 1 session/profile types and existing `UserProfileRepository`, `ProgressRepository`, and `ReviewRepository` interfaces.
- Produces `GuestSessionRepository implements UserSessionRepository` and local implementations of the three learner-state interfaces.

- [ ] **Step 1: Write failing repository contract tests**

Use an injected IndexedDB-like test driver to prove first initialization creates one session/profile, subsequent initialization reuses it, dates round-trip as `Date`, and two Guest IDs have isolated profile/progress/review data.

- [ ] **Step 2: Provide the focused verification command without running it**

```bash
pnpm test -- src/infrastructure/local/guest-database.test.ts src/infrastructure/local/guest-session-repository.test.ts src/infrastructure/local/local-repositories.test.ts
```

- [ ] **Step 3: Implement database and adapters**

Create object stores for `guestSessions`, `profiles`, `progress`, and `reviewItems`; compose keys from the Guest ID and record identity where needed. Centralize serialization/deserialization in `guest-database.ts`; repositories partition every record by supplied Guest ID. Session-aware composition, not the raw local adapters, verifies that feature calls use the active session.

- [ ] **Step 4: Provide the same focused verification command and expected result**

Expected: all listed tests pass. Do not execute it.

### Task 3: Add session-aware learner repository composition

**Files:**
- Create: `src/app/learner-repositories.ts`
- Create: `src/app/learner-repositories.test.ts`
- Modify: `src/infrastructure/firebase/repositories/index.ts`

**Interfaces:**
- Consumes Task 1 `UserSessionRepository` and Task 2 local learner repositories.
- Produces `createLearnerRepositories(deps)` with `progressRepo`, `reviewRepo`, and `userProfileRepo` conforming to their existing interfaces, plus `getActiveUser(): Promise<{ uid: string }>` for existing loader/action factories.

- [ ] **Step 1: Write failing composition tests**

Inject a Guest session and spy repositories. Assert every learner-state method delegates to the matching local adapter with the active Guest ID; assert no Firebase/Anonymous Auth dependency is required. Include an authenticated-session branch test that documents the future Firebase delegation seam.

- [ ] **Step 2: Provide the focused verification command without running it**

```bash
pnpm test -- src/app/learner-repositories.test.ts
```

- [ ] **Step 3: Implement session-aware delegates**

Keep the user-ID repository signatures unchanged. At each delegate call, resolve the active session, verify the supplied user ID equals `session.userId`, then choose local Guest or injected authenticated repository. Export a single app-level dependency object; do not expose concrete local/Firebase adapters to features.

- [ ] **Step 4: Provide the same focused verification command and expected result**

Expected: all listed tests pass. Do not execute it.

### Task 4: Wire routes to Guest-local learner state and content-only Firebase

**Files:**
- Modify: `src/app/router.ts`
- Modify: `src/infrastructure/firebase/firebase.ts`
- Modify: `src/features/course/CourseListPage.loader.ts`
- Modify: `src/features/course/CourseMapPage.loader.ts`
- Modify: `src/features/lesson/LessonDetailPage.loader.ts`
- Modify: `src/features/lesson/LessonDetailPage.action.ts`
- Modify: `src/features/review/ReviewPage.loader.ts`
- Modify: `src/features/review/ReviewPage.action.ts`
- Modify: `src/features/settings/SettingsPage.loader.ts`
- Modify: `src/features/settings/SettingsPage.action.ts`
- Modify: `src/features/profile/ProfilePage.loader.ts`
- Modify: corresponding existing loader/action/router tests

**Interfaces:**
- Consumes Task 3 `getActiveUser` and session-aware learner repositories.
- Produces a router whose existing routes use the active Guest session and local learner state without `signInAnonymouslyIfNeeded`.

- [ ] **Step 1: Update failing route tests**

Replace `ensureUser` fakes that model Firebase Auth with `getActiveUser` fakes. Assert loaders/actions pass the active Guest ID to existing use cases and that router wiring has no anonymous-auth import or call.

- [ ] **Step 2: Provide the focused verification command without running it**

```bash
pnpm test -- src/app src/features/course src/features/lesson src/features/review src/features/settings src/features/profile
```

- [ ] **Step 3: Implement route composition changes**

Create local session/repositories once in the app composition module, preserve Firebase `courseRepo`/`lessonRepo` for content, and wire all route factories to the composed learner repositories and `getActiveUser`. Remove `signInAnonymouslyIfNeeded` and its unused Firebase Auth setup from the route-loading path.

- [ ] **Step 4: Provide the same focused verification command and expected result**

Expected: all listed tests pass. Do not execute it.

### Task 5: Add the Course List display-name editor

**Files:**
- Modify: `src/features/course/CourseListPage.loader.ts`
- Create: `src/features/course/CourseListPage.action.ts`
- Modify: `src/features/course/CourseListPage.tsx`
- Modify: `src/features/course/CourseListPage.test.tsx`
- Modify: `src/features/course/CourseListPage.loader.test.ts`
- Create: `src/features/course/CourseListPage.action.test.ts`

**Interfaces:**
- Consumes Task 1 `updateDisplayName`, Task 3 `getActiveUser` and session-aware `userProfileRepo`.
- Extends `CourseListLoaderData` with `displayName: string` and produces an action returning the saved name.

- [ ] **Step 1: Write failing loader/action/component tests**

Assert the loader returns the Guest profile name, the action updates it for the active Guest ID, and the header initially displays `Guest#1245` with an edit control. Assert editing/saving a new name changes the text but retains the same Guest ID in the repository spy. Assert no flag or onboarding copy is rendered.

- [ ] **Step 2: Provide the focused verification command without running it**

```bash
pnpm test -- src/features/course/CourseListPage.test.tsx src/features/course/CourseListPage.loader.test.ts src/features/course/CourseListPage.action.test.ts
```

- [ ] **Step 3: Implement the edit interaction**

Add the loader profile read and a fetcher action. Render the compact name plus accessible edit/save controls in the existing Course List header; on save submit only the new display name, show the saved value after route revalidation, and preserve the existing Profile/Settings links.

- [ ] **Step 4: Provide the same focused verification command and expected result**

Expected: all listed tests pass. Do not execute it.

### Task 6: Restrict shared-content rules and update project tracking

**Files:**
- Modify: `firestore.rules`
- Modify: `docs/PROGRESS.md`
- Modify: `docs/COMPLETE-LOG.md`

**Interfaces:**
- Consumes the Guest content-read requirement from the spec.
- Produces checked-in rules with public content reads and denied client content writes; no deployment side effect.

- [ ] **Step 1: Update the checked-in Firestore rules**

Set read access for `courses`, `units`, and `lessons` to unauthenticated-public and remove client write permission for those content collections. Leave existing authenticated learner-data paths unchanged because authenticated persistence is out of scope.

- [ ] **Step 2: Update tracking documents**

Mark Guest session/profile and IndexedDB learner-state repositories as done or in-progress only when their code is complete; record the completed milestone and explicitly state that rules were not deployed, tests/build were not run, and auth/migration remain pending.

- [ ] **Step 3: Provide user-run verification and deploy commands without running them**

```bash
pnpm test
pnpm build
firebase deploy --only firestore:rules
```

Expected: tests/build pass locally before the user deploys the reviewed rules.

## Self-Review

- Spec coverage: Tasks 1–5 cover automatic identity, IndexedDB state, adapter composition, name editing, and existing routes; Task 6 covers checked-in rules and documentation. Excluded scope is not introduced.
- Type consistency: `UserSessionRepository.getActiveSession`, `getActiveUser`, and the existing repository interfaces are defined before their consumers. `UserProfile.displayName`/`updatedAt` are added before storage/mapping/UI use.
- Review Focus coverage: every listed risk has a specific owning task and test.
- Proportion: the plan defines interfaces and test proofs without prescribing implementation bodies. It is scoped to one independently shippable Guest milestone.
